// Signed webhook client with retry/backoff

export async function postSignedWebhook(url: string, payload: any, secret?: string, extraHeaders?: Record<string, string>): Promise<Response> {
  const body = JSON.stringify(payload || {});
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (secret) {
    const signature = await hmacSha256Hex(secret, body);
    headers['X-InkIQ-Signature'] = signature;
  }
  return fetch(url, { method: 'POST', headers, body });
}

export async function deliverWithRetry(url: string, payload: any, opts?: { secret?: string; headers?: Record<string, string> }) {
  const schedule = [30_000, 120_000, 600_000];
  let attempt = 0;
  while (attempt < schedule.length) {
    try {
      const res = await postSignedWebhook(url, payload, opts?.secret, opts?.headers);
      if (res.ok) return;
      // Consider 4xx as permanent except 429
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.warn('[webhook] permanent failure', res.status, await safeText(res));
        return;
      }
      console.warn('[webhook] transient failure', res.status, await safeText(res));
    } catch (e) {
      console.warn('[webhook] error', e);
    }
    const backoff = schedule[attempt++];
    await sleep(backoff);
  }
  console.error('[webhook] permanently failed after retries');
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function safeText(res: Response) { try { return await res.text(); } catch { return ''; } }


