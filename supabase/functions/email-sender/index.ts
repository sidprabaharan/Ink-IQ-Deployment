import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Simple outbox drainer. In production, plug real email provider API.
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const projectUrl = Deno.env.get('SUPABASE_URL') || ''
  if (!adminKey || !projectUrl) {
    return new Response('Missing service role configuration', { status: 500, headers: corsHeaders })
  }

  // Fetch pending messages (limit 20)
  const list = await fetch(`${projectUrl}/rest/v1/email_outbox?status=eq.pending&order=created_at.asc&limit=20`, {
    headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey }
  })
  if (!list.ok) return new Response(await list.text(), { status: list.status })
  const pending = await list.json() as any[]
  if (!Array.isArray(pending) || pending.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }

  let sent = 0
  for (const msg of pending) {
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const from = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev'
        const payload = {
          from,
          to: [msg.to_email],
          subject: msg.subject,
          text: msg.body,
        }
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!sendRes.ok) throw new Error(`Resend error ${sendRes.status}: ${await sendRes.text()}`)
      }
      // Mark as sent regardless (stub mode when no RESEND_API_KEY)
      const upd = await fetch(`${projectUrl}/rest/v1/email_outbox?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), attempts: (msg.attempts || 0) + 1 })
      })
      if (!upd.ok) throw new Error(await upd.text())
      sent++
    } catch (e) {
      await fetch(`${projectUrl}/rest/v1/email_outbox?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminKey}`, 'apikey': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', attempts: (msg.attempts || 0) + 1 })
      })
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

Deno.serve(handler)


