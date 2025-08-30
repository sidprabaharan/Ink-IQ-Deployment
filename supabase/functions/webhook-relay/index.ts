import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface RelayBody {
  url: string
  payload?: any
  secret?: string
  method?: string
  headers?: Record<string, string>
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }
    const body = (await req.json()) as RelayBody
    if (!body?.url) {
      return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const method = (body.method || 'POST').toUpperCase()
    const json = JSON.stringify(body.payload ?? {})
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(body.headers || {}),
    }
    if (body.secret) {
      headers['X-InkIQ-Signature'] = await hmacSha256Hex(body.secret, json)
    }

    const res = await fetch(body.url, { method, headers, body: json })
    const text = await res.text().catch(() => '')
    return new Response(JSON.stringify({ status: res.status, ok: res.ok, body: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || 'Relay failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})
