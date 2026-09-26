import { DEMO_HANDLE, DEMO_VERSION } from './demoConfig'
import { withBase } from '../lib/base'
export type DemoReport = { version: string; mode: 'recorded-demo'; handle: string; displayName: string; snapshotAt: string; recordedAt: string; postCount: number; sampledPosts: number; template: string; model: string; content: string; contentHash: string; sources: Array<{ url: string; postedAt: string }> }
export async function validateDemoReport(value: unknown): Promise<DemoReport> {
  const r = value as DemoReport
  if (!r || r.version !== DEMO_VERSION || r.mode !== 'recorded-demo' || r.handle !== DEMO_HANDLE || typeof r.content !== 'string' || !Array.isArray(r.sources) || !/^[a-f0-9]{64}$/.test(r.contentHash)) throw new Error('The saved report is invalid. Please try again.')
  if (typeof r.snapshotAt !== 'string' || !Number.isFinite(Date.parse(r.snapshotAt)) || typeof r.recordedAt !== 'string' || !Number.isFinite(Date.parse(r.recordedAt)) || typeof r.model !== 'string' || typeof r.displayName !== 'string' || r.template !== 'exchange-stance' || !Number.isInteger(r.postCount) || !Number.isInteger(r.sampledPosts) || r.sampledPosts < 1 || r.postCount < r.sampledPosts || r.sources.length !== r.sampledPosts || r.sources.some(s => !s || typeof s.url !== 'string' || !/^https:\/\//.test(s.url) || typeof s.postedAt !== 'string')) throw new Error('The saved report metadata is invalid. Please try again.')
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r.content))
  const hash = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== r.contentHash) throw new Error('Report integrity check failed. Please reload the saved report.')
  return r
}
let pending: Promise<DemoReport> | null = null
export function loadDemoReport() {
  pending ||= fetch(withBase('/demo/nbaluong.json'), { signal: AbortSignal.timeout(10_000) }).then(async response => {
    if (!response.ok) throw new Error('Saved report is unavailable. Please try again.')
    return validateDemoReport(await response.json())
  }).catch(error => { pending = null; throw error })
  return pending
}
