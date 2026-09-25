export type SurfAuthStatus = 'valid' | 'invalid' | 'no-credits' | 'missing' | 'unavailable'

export async function checkSurfAuth(options: {
  apiKey?: string
  baseUrl?: string
  fetcher?: typeof fetch
  timeoutMs?: number
} = {}): Promise<SurfAuthStatus> {
  const apiKey = options.apiKey ?? process.env.SURF_API_KEY ?? ''
  if (!apiKey.trim()) return 'missing'
  const base = (options.baseUrl || process.env.SURF_API_BASE_URL || 'https://api.asksurf.ai/gateway').replace(/\/+$/, '')
  let endpoint: URL
  try {
    endpoint = new URL(base + '/v1/market/price?symbol=SOL')
  } catch {
    return 'unavailable'
  }
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
    return 'unavailable'
  }
  try {
    const response = await (options.fetcher || fetch)(endpoint, {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    })
    if (response.ok) return 'valid'
    if (response.status === 401) return 'invalid'
    if (response.status === 402) return 'no-credits'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}