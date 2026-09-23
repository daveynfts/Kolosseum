import { createHash } from 'node:crypto'

export type SurfUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  creditsUsed: number | null
  cacheHit: boolean
}

export type SurfResult = { text: string; model: string; usage: SurfUsage }

type SurfResponse = {
  status?: string
  model?: string
  output_text?: string
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  meta?: { credits_used?: number }
}

const resultCache = new Map<string, SurfResult>()
const MAX_CACHE_ITEMS = 100

function extractText(data: SurfResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function askSurf(options: {
  cacheIdentity: string
  input: string
  instructions: string
  apiKey?: string
  baseUrl?: string
  fetcher?: typeof fetch
  now?: number
  timeoutMs?: number
  maxAttempts?: number
}): Promise<SurfResult> {
  const key = options.apiKey || process.env.SURF_API_KEY
  if (!key) throw new Error('SURF_API_KEY is not configured')
  const base = (options.baseUrl || process.env.SURF_API_BASE_URL || 'https://api.asksurf.ai/gateway').replace(/\/$/, '')
  const endpoint = new URL(`${base}/v1/responses`)
  if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') {
    throw new Error('Surf API must use HTTPS')
  }
  const model = 'surf-2.0'
  const hourBucket = Math.floor((options.now ?? Date.now()) / 3_600_000)
  const cacheKey = createHash('sha256')
    .update(JSON.stringify([options.cacheIdentity, model, options.input, options.instructions, hourBucket]))
    .digest('hex')
  const cached = resultCache.get(cacheKey)
  if (cached) return { ...cached, usage: { ...cached.usage, cacheHit: true, creditsUsed: 0 } }

  const fetcher = options.fetcher || fetch
  const maxAttempts = Math.min(3, Math.max(1, options.maxAttempts ?? 2))
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          input: options.input,
          instructions: options.instructions,
          reasoning: { effort: 'low' },
          stream: false,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 65_000),
      })
    } catch (error) {
      if (attempt < maxAttempts) {
        await sleep(250 * attempt)
        continue
      }
      throw new Error('Surf request failed or timed out', { cause: error })
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        await sleep(250 * attempt)
        continue
      }
      // Do not include provider response bodies: they can echo credentials or prompt content.
      throw new Error(`Surf returned HTTP ${response.status}`)
    }
    const data = await response.json() as SurfResponse
    if (data.status && data.status !== 'completed') throw new Error(`Surf response status: ${data.status}`)
    const text = extractText(data)
    if (!text) throw new Error('Surf returned no research text')
    const result: SurfResult = {
      text,
      model: data.model || model,
      usage: {
        inputTokens: Number.isFinite(data.usage?.input_tokens) ? data.usage!.input_tokens! : null,
        outputTokens: Number.isFinite(data.usage?.output_tokens) ? data.usage!.output_tokens! : null,
        totalTokens: Number.isFinite(data.usage?.total_tokens) ? data.usage!.total_tokens! : null,
        creditsUsed: Number.isFinite(data.meta?.credits_used) ? data.meta!.credits_used! : null,
        cacheHit: false,
      },
    }
    resultCache.set(cacheKey, result)
    if (resultCache.size > MAX_CACHE_ITEMS) resultCache.delete(resultCache.keys().next().value!)
    return result
  }
  throw new Error('Surf retry budget exhausted')
}
