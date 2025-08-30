// Thin client helpers for PromoStandards SOAP/REST calls will be added per-supplier.
// For now, we expose a shape to plug real HTTP implementations later.

export interface HttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>
  post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>
}

export class FetchHttpClient implements HttpClient {
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
    return (await res.json()) as T
  }
  async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers||{}) }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`)
    return (await res.json()) as T
  }
}



