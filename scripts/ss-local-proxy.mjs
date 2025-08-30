import express from 'express'

const PORT = process.env.SS_PROXY_PORT ? Number(process.env.SS_PROXY_PORT) : 8081
const BASE = process.env.SS_BASE_URL || 'https://api.ssactivewear.com/V2/'
const ACCOUNT = process.env.SS_ACCOUNT || process.env.SUPPLIER_SS_ACCOUNT_NO_US || ''
const API_KEY = process.env.SS_API_KEY || process.env.SUPPLIER_SS_API_KEY_A || ''

if (!ACCOUNT || !API_KEY) {
  console.error('Missing SS_ACCOUNT and/or SS_API_KEY in env')
  process.exit(1)
}

const app = express()
app.use(express.json())

// Basic CORS support for browser calls from Vite dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function buildHeaders(variant = 'basic') {
  const h = { 'Accept': 'application/json' }
  if (variant === 'basic') return { ...h, Authorization: `Basic ${Buffer.from(`${ACCOUNT}:${API_KEY}`).toString('base64')}` }
  if (variant === 'std') return { ...h, AccountNumber: ACCOUNT, ApiKey: API_KEY }
  return { ...h, 'X-Account-Number': ACCOUNT, 'X-API-Key': API_KEY }
}

async function tryFetch(url) {
  const variants = ['basic', 'std', 'xhdr']
  let lastErr
  for (const v of variants) {
    try {
      const res = await fetch(url, { method: 'GET', headers: buildHeaders(v) })
      const text = await res.text()
      if (!res.ok) { lastErr = new Error(`status_${res.status}:${text.slice(0,200)}`); continue }
      try { return JSON.parse(text) } catch { return {} }
    } catch (e) { lastErr = e }
  }
  throw lastErr
}

app.get('/ss/search', async (req, res) => {
  try {
    const { q = '', page = '1', pageSize = '8' } = req.query
    const u = new URL('Products', BASE)
    u.searchParams.set('search', String(q))
    u.searchParams.set('page', String(page))
    u.searchParams.set('pageSize', String(pageSize))
    u.searchParams.set('mediaType', 'json')
    const json = await tryFetch(u.toString())
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

app.get('/ss/inventory', async (req, res) => {
  try {
    const { styleId = '', skus = '' } = req.query
    const u = new URL('Products', BASE)
    if (styleId) u.searchParams.set('STYLEID', String(styleId))
    if (skus) u.searchParams.set('SKU', String(skus))
    u.searchParams.set('page', '1')
    u.searchParams.set('pageSize', '200')
    u.searchParams.set('mediaType', 'json')
    const json = await tryFetch(u.toString())
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

app.get('/ss/ping', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`S&S local proxy listening on http://localhost:${PORT} -> ${BASE}`)
})


