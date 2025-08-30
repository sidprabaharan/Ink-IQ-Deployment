import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// ------------------------------
// Input contracts (server-only)
// ------------------------------
type SearchProductsInput = { query: string; page?: number }
type GetInventoryInput = { styleId: number; force?: boolean }

type OpRequest =
  | { op: 'searchProducts'; params: SearchProductsInput; debug?: boolean }
  | { op: 'getInventory'; params: GetInventoryInput; debug?: boolean }
  | { op: 'probe'; debug?: boolean }
  | { op: 'diagnostics' }

// ------------------------------
// Output DTOs (exact shapes)
// ------------------------------
type ProductSearchResult = {
  styleId: number
  brand: string
  styleCode: string
  name: string
  colors: Array<{ colorName: string; colorCode?: string; swatchUrl?: string }>
  sizes: string[]
  price: { min: number; max: number; currency: 'USD' | 'CAD' }
  heroImageUrl?: string
  styleUrl?: string
  variants: Array<{
    sku: string
    color: string
    size: string
    price: number
    images?: { front?: string; side?: string; back?: string; swatch?: string }
  }>
  supplier: 'S&S'
}

type InventoryMatrix = {
  styleId: number
  warehouses: string[]
  sizes: string[]
  qty: Record<string, number>
  asOf: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'authorization', 'Authorization',
    'x-client-info', 'X-Client-Info',
    'x-supabase-authorization', 'X-Supabase-Authorization',
    'apikey', 'apiKey', 'ApiKey',
    'content-type', 'Content-Type',
  ].join(', '),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Simple in-memory cache per worker (best-effort)
const cache = new Map<string, { exp: number; data: any }>()

function getEnv(name: string, fallback?: string) {
  const v = Deno.env.get(name)
  return v ?? fallback
}

// Env (user-provided)
const SS_BASE_URL = getEnv('SS_BASE_URL', 'https://api.ssactivewear.com/V2/')!
const SS_ACCOUNT_NUMBER = getEnv('SS_ACCOUNT_NUMBER', '')!
const SS_API_KEY = getEnv('SS_API_KEY', '')!
const SS_SANDBOX = getEnv('SS_SANDBOX', 'false') === 'true'

// Behavior configuration
const TIMEOUT_MS = Number(getEnv('SS_TIMEOUT_MS', '10000'))
const CATALOG_TTL_MS = Number(getEnv('CATALOG_CACHE_TTL_HOURS', '12')) * 3600 * 1000
const INV_TTL_MS = Number(getEnv('INVENTORY_CACHE_TTL_MINUTES', '10')) * 60 * 1000
const PRICE_CURRENCY: 'USD' | 'CAD' = (getEnv('PRICE_CURRENCY', 'USD') as any) === 'CAD' ? 'CAD' : 'USD'
const IMAGE_VARIANT = getEnv('IMAGE_VARIANT', 'fm')
const PRICE_FIELD = getEnv('SS_PRICE_FIELD', 'price') // fallback until confirmed (e.g., wholesale/tier)

// Retry with exponential backoff and jitter
async function retry<T>(fn: () => Promise<T>, attempts = 3, base = 300): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const msg = String((e as Error)?.message || '')
      if (msg.startsWith('rate_limited:')) {
        const ms = Number(msg.split(':')[1] || '1000')
        await new Promise(r => setTimeout(r, ms))
      } else {
        const delay = base * Math.pow(2, i) + Math.floor(Math.random() * 150)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastErr
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

function getAuth(): { base: string; account: string; key: string } {
  return { base: SS_BASE_URL, account: SS_ACCOUNT_NUMBER, key: SS_API_KEY }
}

async function doFetchJson(url: string, options: RequestInit & { account: string; apiKey: string }) {
  const basic = btoa(`${options.account}:${options.apiKey}`)
  // Prefer Basic auth first (confirmed working), then header styles
  const variants: Record<string, string>[] = [
    { 'Authorization': `Basic ${basic}` },
    { 'AccountNumber': options.account, 'ApiKey': options.apiKey },
    { 'X-Account-Number': options.account, 'X-API-Key': options.apiKey },
  ]
  let lastErr: any
  for (const auth of variants) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as any || {}),
      ...auth,
    }
    try {
      const start = Date.now()
      const res = await withTimeout(fetch(url, { ...options, headers }), TIMEOUT_MS)
      const latencyMs = Date.now() - start
      const text = await res.text().catch(() => '')
      if (res.status === 429) {
        const ra = res.headers.get('Retry-After')
        const retryAfterMs = ra ? Number(ra) * 1000 : 1000
        throw new Error(`rate_limited:${retryAfterMs}`)
      }
      if (!res.ok) {
        lastErr = new Error(`status_${res.status}:${text?.slice(0, 200)}`)
        console.error('[suppliers-ss] http_error', { url, status: res.status, latencyMs })
        continue
      }
      try {
        return { json: text ? JSON.parse(text) : {}, latencyMs }
      } catch {
        return { json: {}, latencyMs }
      }
    } catch (e) {
      lastErr = e
      console.error('[suppliers-ss] fetch_error', { url, message: String((e as Error)?.message || e) })
    }
  }
  throw lastErr
}

// Normalizers (shallow – refine once real payload known)
function normalizeSizes(size: string): string {
  const s = (size || '').toLowerCase()
  if (['xs', 'xsmall', 'x-small'].includes(s)) return 'XS'
  if (['s', 'small'].includes(s)) return 'S'
  if (['m', 'medium'].includes(s)) return 'M'
  if (['l', 'large'].includes(s)) return 'L'
  if (['xl', 'x-large', 'xlarge', 'x‑large', 'x‑l'].includes(s)) return 'XL'
  if (['2xl', 'xxl', '2x-large', 'xx-large', 'tg'].includes(s)) return '2XL'
  if (['3xl', 'xxxl', '3x-large'].includes(s)) return '3XL'
  if (['4xl', 'xxxxl', '4x-large'].includes(s)) return '4XL'
  return size?.toUpperCase() || 'M'
}

function cacheGet(key: string) {
  const v = cache.get(key)
  if (!v) return null
  if (Date.now() > v.exp) { cache.delete(key); return null }
  return v.data
}
function cacheSet(key: string, data: any, ttlMs: number) { cache.set(key, { exp: Date.now() + ttlMs, data }) }

async function ssSearchProducts(params: SearchProductsInput): Promise<ProductSearchResult[]> {
  const page = params.page || 1
  const cacheKey = `search:${params.query}:${page}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const auth = getAuth()
  const tried: string[] = []

  // 1) Styles query (stable, cacheable)
  const styles = await searchStyles(auth, params.query, page, 8)
  const styleIds = styles.map(s => String(s.styleId)).filter(Boolean)

  // 2) For each style id, fetch products and map to ProductSearchResult
  const results: ProductSearchResult[] = []
  for (const sid of styleIds) {
    try {
      const prodJson = await fetchProductsByStyleIds(auth, [sid], 1, 200)
      const mapped = mapProductsToSearchDTOs(prodJson)
      results.push(...mapped)
          } catch {}
  }

  cacheSet(cacheKey, results, CATALOG_TTL_MS)
  return results
}

async function searchStyles(p: { base: string; account: string; key: string }, query: string, page: number, size: number) {
  const isLikelyStyleId = /^[A-Za-z0-9\-]+$/.test(query || '')

  const attempt = async (params: Record<string, string>) => {
    const u = new URL('Styles', p.base)
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
    u.searchParams.set('page', String(page))
    u.searchParams.set('pageSize', String(size))
    u.searchParams.set('mediaType', 'json')
    const { json } = await retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key }))
    const items = Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.styles) ? json.styles
      : Array.isArray(json?.Results) ? json.Results
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.value) ? json.value
      : []
    return items
  }

  // Try targeted style id filters first if query looks like a style id
  const variants: Record<string, string>[] = isLikelyStyleId
    ? [ { styleId: query }, { STYLEID: query }, { style: query }, { styleNumber: query } ]
    : []
  for (const v of variants) {
    try {
      const items = await attempt(v)
      if (items.length > 0) return items.map((s: any) => ({ styleId: s?.styleId || s?.style || s?.styleNumber }))
    } catch {}
  }

  // Try part number filters (some styles resolve only via PARTNUMBER)
  const partVariants: Record<string, string>[] = [ { partNumber: query }, { PARTNUMBER: query }, { part: query } ]
  for (const v of partVariants) {
    try {
      const items = await attempt(v)
      if (items.length > 0) return items.map((s: any) => ({ styleId: s?.styleId || s?.style || s?.styleNumber }))
    } catch {}
  }

  // Fallback to generic search param names
  const searchVariants: Record<string, string>[] = [ { search: query }, { q: query }, { query } ]
  for (const v of searchVariants) {
    try {
      const items = await attempt(v)
      if (items.length > 0) return items.map((s: any) => ({ styleId: s?.styleId || s?.style || s?.styleNumber }))
    } catch {}
  }

  return []
}

async function fetchProductsByStyleIds(p: { base: string; account: string; key: string }, styleIds: string[], page: number, size: number) {
  // Try multiple param/endpoint casings
  const attempts = [
    () => { const u = new URL('Products', p.base); u.searchParams.set('STYLEID', String(styleIds[0])); u.searchParams.set('page', String(page)); u.searchParams.set('pageSize', String(size)); u.searchParams.set('mediaType','json'); return retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key })) },
    () => { const u = new URL('products', p.base); u.searchParams.set('STYLEID', String(styleIds[0])); u.searchParams.set('page', String(page)); u.searchParams.set('pageSize', String(size)); u.searchParams.set('mediaType','json'); return retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key })) },
    () => { const u = new URL('Products', p.base); u.searchParams.set('PARTNUMBER', String(styleIds[0])); u.searchParams.set('page', String(page)); u.searchParams.set('pageSize', String(size)); u.searchParams.set('mediaType','json'); return retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key })) },
    () => { const u = new URL('products', p.base); u.searchParams.set('PARTNUMBER', String(styleIds[0])); u.searchParams.set('page', String(page)); u.searchParams.set('pageSize', String(size)); u.searchParams.set('mediaType','json'); return retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key })) },
  ]
  let lastErr: any
  for (const fn of attempts) {
    try {
      const { json } = await fn()
      return json
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('products by style failed')
}

function mapProductsToSearchDTOs(json: any): ProductSearchResult[] {
  const items = Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.products)
      ? json.products
      : Array.isArray(json?.value)
        ? json.value
        : []

  const cdnBase = 'https://cdn.ssactivewear.com/'

  const results: ProductSearchResult[] = []
  for (const it of items) {
    const styleIdRaw = it?.styleId ?? it?.styleID ?? it?.style ?? it?.styleNumber
    const styleIdNum = Number(String(styleIdRaw).replace(/[^0-9]/g, '')) || 0
    // Style/brand/name
    const brand = it?.brandName || it?.brand || it?.BRANDNAME || ''
    const styleCode = it?.partNumber || it?.PARTNUMBER || [brand, it?.style].filter(Boolean).join(' ').trim()
    const name = it?.name || it?.styleName || it?.description || ''

    // Variants & prices
    const variantsArr = Array.isArray(it?.variants)
      ? it.variants
      : Array.isArray(it?.skus)
        ? it.skus
        : []

    const variants: ProductSearchResult['variants'] = []
    const sizeSet = new Set<string>()
    const colorMap = new Map<string, { colorName: string; colorCode?: string; swatchUrl?: string }>()
    let minPrice = Number.POSITIVE_INFINITY
    let maxPrice = 0

    for (const v of variantsArr) {
      const sku = v?.sku || v?.SKU || v?.skuId || v?.variantSku || ''
      const colorName = v?.colorName || v?.color || ''
      const colorCode = v?.colorCode || v?.COLORCODE || undefined
      const size = normalizeSizes(v?.size || v?.sizeName || v?.SIZE || '')
      const priceRaw = v?.[PRICE_FIELD] ?? v?.price ?? v?.wholesale ?? 0
      const price = Number(priceRaw) || 0
      minPrice = Math.min(minPrice, price)
      maxPrice = Math.max(maxPrice, price)
      sizeSet.add(size)
      if (colorName && !colorMap.has(colorName)) {
        const swatchRel = v?.swatchImage || v?.swatch || v?.swatchUrl || ''
        const swatchUrl = swatchRel ? cdnBase + String(swatchRel).replace(/^\//, '') : undefined
        colorMap.set(colorName, { colorName, colorCode, swatchUrl })
      }
      const imgFrontRel = v?.imageFront || v?.frontImage || v?.front
      const imgSideRel = v?.imageSide || v?.sideImage || v?.side
      const imgBackRel = v?.imageBack || v?.backImage || v?.back
      variants.push({
        sku,
        color: colorName,
        size,
        price,
      images: {
          front: imgFrontRel ? cdnBase + String(imgFrontRel).replace(/^\//, '') : undefined,
          side: imgSideRel ? cdnBase + String(imgSideRel).replace(/^\//, '') : undefined,
          back: imgBackRel ? cdnBase + String(imgBackRel).replace(/^\//, '') : undefined,
          swatch: colorMap.get(colorName)?.swatchUrl,
        },
      })
    }

    if (!isFinite(minPrice)) minPrice = 0
    const heroRel = it?.styleImage || it?.image || it?.STYLEIMAGE || ''
    const heroImageUrl = heroRel ? cdnBase + String(heroRel).replace(/^\//, '') : undefined
    const colors = Array.from(colorMap.values())
    const sizes = Array.from(sizeSet)

    const dto: ProductSearchResult = {
      styleId: styleIdNum,
      brand,
      styleCode: String(styleCode || '').trim(),
      name,
      colors,
      sizes,
      price: { min: Number(minPrice.toFixed(2)), max: Number(maxPrice.toFixed(2)), currency: PRICE_CURRENCY },
      heroImageUrl,
      styleUrl: it?.productUrl || it?.styleUrl || undefined,
      variants,
      supplier: 'S&S',
    }
    // Only push if styleId present
    if (dto.styleId) results.push(dto)
  }
  return results
}

async function ssGetInventory(params: GetInventoryInput): Promise<InventoryMatrix> {
  const cacheKey = `inv:${params.styleId}`
  if (!params.force) {
  const cached = cacheGet(cacheKey)
  if (cached) return cached
  }

  const p = getAuth()
  const u = new URL('Products', p.base)
  u.searchParams.set('STYLEID', String(params.styleId))
        u.searchParams.set('page', '1')
        u.searchParams.set('pageSize', '200')
        u.searchParams.set('mediaType', 'json')
  // Best-effort field filtering (exact param naming varies across docs)
  u.searchParams.set('fields', 'SKU,QTY,WAREHOUSES,SIZE,COLOR')
  const { json } = await retry(() => doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key }))

  const matrix = mapInventoryToMatrix(json, params.styleId)
  cacheSet(cacheKey, matrix, INV_TTL_MS)
  return matrix
}

async function diagnostics() {
  const p = getAuth()
  const attempts: Array<{ base: string; endpoint: string; url: string; ok: boolean; count?: number; keys?: string[]; note?: string }> = []
    const paths = ['Styles', 'styles', 'Products', 'products']
    for (const ep of paths) {
      try {
        const u = new URL(ep, p.base)
        u.searchParams.set('page', '1')
        u.searchParams.set('pageSize', '1')
        const { json } = await doFetchJson(u.toString(), { method: 'GET', account: p.account, apiKey: p.key })
        const arr = Array.isArray(json?.items) ? json.items
          : Array.isArray(json?.products) ? json.products
          : Array.isArray(json?.styles) ? json.styles
          : Array.isArray(json?.Results) ? json.Results
          : Array.isArray(json?.data) ? json.data
          : []
        const first = arr?.[0] || {}
        attempts.push({ base: p.base, endpoint: ep, url: u.toString(), ok: true, count: arr.length, keys: Object.keys(first).slice(0, 20) })
      } catch (e) {
        attempts.push({ base: p.base, endpoint: ep, url: new URL(ep, p.base).toString(), ok: false, note: String((e as Error)?.message || e) })
    }
  }
  return { attempts }
}

async function probe() {
  const base = SS_BASE_URL
  const account = SS_ACCOUNT_NUMBER
  const key = SS_API_KEY
        const u = new URL('Products', base)
        u.searchParams.set('page', '1')
        u.searchParams.set('pageSize', '1')
        u.searchParams.set('mediaType', 'json')
        const url = u.toString()
  const basic = btoa(`${account}:${key}`)
        const variants: Array<{ name: 'basic'|'std'|'xhdr'; headers: Record<string,string> }> = [
          { name: 'basic', headers: { 'Accept': 'application/json', 'Authorization': `Basic ${basic}` } },
    { name: 'std', headers: { 'Accept': 'application/json', 'AccountNumber': account, 'ApiKey': key } },
    { name: 'xhdr', headers: { 'Accept': 'application/json', 'X-Account-Number': account, 'X-API-Key': key } },
        ]
  const results: Array<{ url: string; base: string; authVariant: 'basic'|'std'|'xhdr'; status?: number; ok: boolean; latencyMs?: number; snippet?: string; error?: string }> = []
        for (const v of variants) {
          try {
            const start = Date.now()
            const res = await withTimeout(fetch(url, { method: 'GET', headers: v.headers }), 3500)
            const latencyMs = Date.now() - start
            const text = await res.text().catch(() => '')
      results.push({ url, base, authVariant: v.name, status: res.status, ok: res.ok, latencyMs, snippet: text.slice(0, 200) })
          } catch (e) {
      results.push({ url, base, authVariant: v.name, ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return { results }
}

function mapInventoryToMatrix(json: any, styleId: number): InventoryMatrix {
  const entries = Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.products)
      ? json.products
      : Array.isArray(json?.value)
        ? json.value
        : []

  const warehouseSet = new Set<string>()
  const sizeSet = new Set<string>()
  const qty: Record<string, number> = {}

  for (const e of entries) {
    const size = normalizeSizes(String(e?.size || e?.SIZE || e?.sizeName || ''))
    if (size) sizeSet.add(size)
    const warehouses = Array.isArray(e?.warehouses) ? e?.warehouses : (Array.isArray(e?.warehouseQuantities) ? e?.warehouseQuantities : [])
    for (const w of warehouses) {
      const code = String(w?.warehouseAbbr || w?.code || w?.warehouseCode || '').trim()
      if (!code) continue
      warehouseSet.add(code)
      const q = Number(w?.qty || w?.quantity || w?.onHand || 0)
      const key = `${code}|${size}`
      qty[key] = (qty[key] || 0) + q
    }
  }

  const warehouses = Array.from(warehouseSet)
  const sizes = Array.from(sizeSet)

  return {
    styleId,
    warehouses,
    sizes,
    qty,
    asOf: new Date().toISOString(),
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    const body = (await req.json().catch(() => ({}))) as OpRequest
    if (!body || !('op' in body)) return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    if (body.op === 'searchProducts') {
      const data = await ssSearchProducts(body.params as SearchProductsInput)
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    if (body.op === 'getInventory') {
      const data = await ssGetInventory(body.params as GetInventoryInput)
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    if (body.op === 'diagnostics') {
      const data = await diagnostics()
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    if (body.op === 'probe') {
      const data = await probe()
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    return new Response(JSON.stringify({ error: 'unsupported_op' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (e) {
    const msg = (e as Error)?.message || 'internal_error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})


