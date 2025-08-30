import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

type AutomationEvent = {
  id: string
  org_id: string
  entity_type: string
  entity_id: string | null
  from_status: string | null
  to_status: string
  payload: any
}

// Minimal server-side runner: reads org settings, matches rules, executes actions (webhook + log)
async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function triggerWebhook(url: string, body: any, secret?: string) {
  const payload = JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret) {
    const signature = await hmacSha256Hex(secret, payload)
    headers['X-InkIQ-Signature'] = signature
  }
  return fetch(url, { method: 'POST', headers, body: payload })
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fetch one pending event, lock it, process, and mark done
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const projectUrl = Deno.env.get('SUPABASE_URL') || ''
    if (!adminKey || !projectUrl) {
      return new Response('Missing service role configuration', { status: 500, headers: corsHeaders })
    }
    // 1) Fetch one pending event
    const listRes = await fetch(`${projectUrl}/rest/v1/automation_events?status=eq.pending&order=created_at.asc&limit=1`, {
      headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey }
    })
    if (!listRes.ok) throw new Error(`list pending failed: ${await listRes.text()}`)
    const list = await listRes.json() as AutomationEvent[]
    if (!Array.isArray(list) || list.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending events' }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    const event = list[0]

    // 1b) Attempt to claim atomically via conditional update (best-effort)
    const claimRes = await fetch(`${projectUrl}/rest/v1/automation_events?id=eq.${event.id}&status=eq.pending`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ status: 'processing', attempts: (event as any).attempts + 1 })
    })
    if (!claimRes.ok) throw new Error(`claim failed: ${await claimRes.text()}`)
    const claimedArr = await claimRes.json()
    if (!Array.isArray(claimedArr) || claimedArr.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending events (claimed by another worker)' }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    const claimed = claimedArr[0] as AutomationEvent

    // 2) Load org settings for automations
    const orgRes = await fetch(`${projectUrl}/rest/v1/orgs?id=eq.${event.org_id}&select=settings`, {
      headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey }
    })
    const orgRows = await orgRes.json() as Array<{ settings: any }>
    const orgSettings = (orgRows[0]?.settings || {}) as any
    const rules = (orgSettings.automations?.statusChanges || []) as Array<any>

    const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '_')
    const target = normalize(event.to_status)
    const matching = rules.filter(r => r.enabled && normalize(r.toStatus) === target)

    const runs: any[] = []
    // 3) Execute matching actions
    if (matching.length === 0) {
      // Fallback: create a notification so users can see processing is working
      try {
        await fetch(`${projectUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ org_id: event.org_id, title: 'Automation (no rule matched)', message: `Status changed to ${event.to_status}`, level: 'info' }])
        })
        runs.push({ event_id: event.id, rule_id: null, action_type: 'fallback_notification', status: 'success', error: null, context: { to: event.to_status } })
      } catch (e: any) {
        runs.push({ event_id: event.id, rule_id: null, action_type: 'fallback_notification', status: 'error', error: e?.message || 'insert failed', context: { to: event.to_status } })
      }
    }
    for (const rule of matching) {
      for (const action of (rule.actions || [])) {
        if (action?.enabled === false) continue
        let status = 'success'
        let error: string | undefined
        try {
          if (action.type === 'trigger_webhook') {
            const url = action.params?.url
            if (url) {
              const secret = action.params?.secret || orgSettings?.automations?.webhookSecret
              await triggerWebhook(url, { event, action: { type: action.type } }, secret)
            }
          } else if (action.type === 'send_email') {
            // Insert into email_outbox with minimal details
            const to = action.params?.to || action.params?.recipient || 'customer'
            const subject = action.params?.subject || `Status changed to ${event.to_status}`
            const body = action.params?.body || JSON.stringify({ event })
            const ins = await fetch(`${projectUrl}/rest/v1/email_outbox`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
              body: JSON.stringify([{ org_id: event.org_id, to_email: to, subject, body, template: action.params?.template || null, variables: action.params?.variables || null }])
            })
            if (!ins.ok) throw new Error(`email_outbox insert failed: ${await ins.text()}`)
          } else if (action.type === 'create_notification') {
            const title = 'Automation'
            const message = action.params?.message || `Status changed to ${event.to_status}`
            const ins = await fetch(`${projectUrl}/rest/v1/notifications`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
              body: JSON.stringify([{ org_id: event.org_id, title, message, level: action.params?.level || 'info' }])
            })
            if (!ins.ok) throw new Error(`notifications insert failed: ${await ins.text()}`)
          }
          // Other actions can be added here later (emails, notifications)
        } catch (e: any) {
          status = 'error'
          error = e?.message || String(e)
        }
        runs.push({
          event_id: event.id,
          rule_id: rule.id,
          action_type: action.type,
          status,
          error: error || null,
          context: action.params || {}
        })
      }
    }

    // 4) Persist runs and mark event done
    if (runs.length > 0) {
      await fetch(`${projectUrl}/rest/v1/automation_runs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(runs)
      })
    }

    // Mark event done
    await fetch(`${projectUrl}/rest/v1/automation_events?id=eq.${event.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', processed_at: new Date().toISOString() })
    })

    return new Response(JSON.stringify({ processed: event.id, actions: runs.length }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(e?.message || 'Automation worker error', { status: 500, headers: corsHeaders })
  }
}

Deno.serve(handler)


