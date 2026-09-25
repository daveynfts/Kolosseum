import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { decryptReport, encryptReport } from '../evidence/reportCrypto'

export type SurfUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  creditsUsed: number | null
  creditsSource: 'provider' | 'published-rate' | 'cache'
  cacheHit: boolean
}

export type SurfResult = { text: string; model: string; usage: SurfUsage }

type SurfEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

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
const PUBLISHED_CREDITS: Record<SurfEffort, number> = {
  none: 20, minimal: 30, low: 50, medium: 120, high: 150, xhigh: 200,
}

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
  return new Promise((done) => setTimeout(done, ms))
}

function cached(result: SurfResult): SurfResult {
  return { ...result, usage: { ...result.usage, cacheHit: true, creditsUsed: 0, creditsSource: 'cache' } }
}

async function loadDiskCache(directory: string, key: string, encryptionKey: string): Promise<SurfResult | null> {
  let encrypted: string
  try {
    encrypted = await readFile(join(resolve(directory), key + '.json'), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error('Surf cache could not be read', { cause: error })
  }
  try {
    const data = JSON.parse(decryptReport(encrypted, encryptionKey)) as SurfResult
    if (typeof data.text !== 'string' || !data.text.trim() || typeof data.model !== 'string' ||
      !data.usage || typeof data.usage !== 'object') throw new Error('Invalid Surf cache shape')
    return data
  } catch {
    // An invalid cache must not silently trigger another billable Surf request.
    throw new Error('Surf cache is invalid')
  }
}

async function saveDiskCache(directory: string, key: string, encryptionKey: string, result: SurfResult): Promise<void> {
  const folder = resolve(directory)
  await mkdir(folder, { recursive: true })
  const target = join(folder, key + '.json')
  const temporary = join(folder, key + '.' + randomUUID() + '.tmp')
  await writeFile(temporary, encryptReport(JSON.stringify(result), encryptionKey), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temporary, target)
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
  cacheDir?: string
  encryptionKey?: string
  effort?: SurfEffort
}): Promise<SurfResult> {
  const key = options.apiKey || process.env.SURF_API_KEY
  if (!key) throw new Error('SURF_API_KEY is not configured')
  const base = (options.baseUrl || process.env.SURF_API_BASE_URL || 'https://api.asksurf.ai/gateway').replace(/\/$/, '')
  const endpoint = new URL(`${base}/v1/responses`)
  if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') {
    throw new Error('Surf API must use HTTPS')
  }
  const model = 'surf-2.0'
  const effort = options.effort || process.env.SURF_REASONING_EFFORT || 'low'
  if (!['none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)) {
    throw new Error('Invalid Surf reasoning effort')
  }
  const hourBucket = Math.floor((options.now ?? Date.now()) / 3_600_000)
  const cacheKey = createHash('sha256')
    .update(JSON.stringify([options.cacheIdentity, model, effort, options.input, options.instructions, hourBucket]))
    .digest('hex')
  const memoryHit = resultCache.get(cacheKey)
  if (memoryHit) return cached(memoryHit)

  const cacheDir = options.cacheDir ?? process.env.SURF_CACHE_DIR
  const encryptionKey = options.encryptionKey ?? process.env.REPORT_ENC_KEY
  if (cacheDir && !encryptionKey) throw new Error('REPORT_ENC_KEY is required for Surf cache')
  if (cacheDir && encryptionKey) {
    const diskHit = await loadDiskCache(cacheDir, cacheKey, encryptionKey)
    if (diskHit) {
      resultCache.set(cacheKey, diskHit)
      return cached(diskHit)
    }
  }

  const fetcher = options.fetcher || fetch
  // An ambiguous network timeout may already have consumed credits upstream.
  // Callers can opt into a retry, but one attempt is the safe default.
  const maxAttempts = Math.min(3, Math.max(1, options.maxAttempts ?? 1))
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
          ...(effort === 'none' ? {} : { reasoning: { effort } }),
          stream: false,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 240_000),
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
        creditsUsed: Number.isFinite(data.meta?.credits_used) ? data.meta!.credits_used! : PUBLISHED_CREDITS[effort as SurfEffort],
        creditsSource: Number.isFinite(data.meta?.credits_used) ? 'provider' : 'published-rate',
        cacheHit: false,
      },
    }
    resultCache.set(cacheKey, result)
    if (resultCache.size > MAX_CACHE_ITEMS) resultCache.delete(resultCache.keys().next().value!)
    if (cacheDir && encryptionKey) {
      try { await saveDiskCache(cacheDir, cacheKey, encryptionKey, result) }
      catch { process.stderr.write('Surf cache could not be saved; the result remains in memory.\n') }
    }
    return result
  }
  throw new Error('Surf retry budget exhausted')
}
