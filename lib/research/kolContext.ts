import {
  actorMatrixPos,
  recomputeScexScores,
  type MapRankInput,
  type ScexActor,
  type ScexDataset,
  type ScexPost,
} from '../../src/data/scexTracking'

export type KolContext = {
  actor: Pick<ScexActor, 'id' | 'handle' | 'displayName' | 'followers' | 'postsVolume' | 'qualityScore' | 'volumeScore' | 'sentiment' | 'quadrant' | 'avatarUrl'>
  mapRank: string | null
  matrix: { x: number; y: number; volumeSplit: number; qualitySplit: number }
  posts: Array<Pick<ScexPost, 'id' | 'url' | 'text' | 'postedAt' | 'sentiment' | 'likes' | 'replies' | 'reposts' | 'views'>>
  source: { scexAsOf: string; scexUpdatedAt: string | null; kolsUpdatedAt: string | null }
}

type FetchLike = typeof fetch

async function fetchJson(url: string, fetcher: FetchLike, timeoutMs: number): Promise<unknown> {
  const response = await fetcher(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Radar API returned HTTP ${response.status}`)
  return response.json()
}

export async function loadKolContext(
  rawHandle: string,
  options: { baseUrl?: string; fetcher?: FetchLike; postLimit?: number; timeoutMs?: number } = {},
): Promise<KolContext> {
  const handle = rawHandle.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Invalid X handle')
  const base = new URL(options.baseUrl || process.env.RADAR_API_BASE || 'https://radar.daveynfts.com')
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid Radar API base URL')
  const fetcher = options.fetcher || fetch
  const timeoutMs = options.timeoutMs || 12_000
  const [scexRaw, kolsRaw] = await Promise.all([
    fetchJson(new URL('/api/scex-tracking', base).toString(), fetcher, timeoutMs),
    fetchJson(new URL('/api/kols', base).toString(), fetcher, timeoutMs),
  ])
  if (!scexRaw || typeof scexRaw !== 'object' || !('actors' in scexRaw) || !('posts' in scexRaw) || !('config' in scexRaw)) {
    throw new Error('Radar SCEX response has an unexpected shape')
  }
  if (!kolsRaw || typeof kolsRaw !== 'object' || !('kols' in kolsRaw)) {
    throw new Error('Radar KOL response has an unexpected shape')
  }
  const scex = scexRaw as ScexDataset
  const kols = kolsRaw as { kols: MapRankInput[]; updatedAt?: string }
  if (!Array.isArray(scex.actors) || !Array.isArray(scex.posts) || !Array.isArray(kols.kols)) {
    throw new Error('Radar data lists are missing')
  }
  const scored = recomputeScexScores(scex, kols.kols)
  const actor = scored.actors.find((a) => a.handle.toLowerCase() === handle && a.kind === 'kol')
  if (!actor) throw new Error('KOL not found in the live SCEX dataset')
  const mapKol = kols.kols.find((k) => k.handle.replace(/^@/, '').toLowerCase() === handle)
  const postLimit = Math.min(50, Math.max(1, options.postLimit ?? 20))
  const posts = scored.posts
    .filter((p) => p.handle.toLowerCase() === handle)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
    .slice(0, postLimit)
    .map((p) => ({
      id: p.id,
      url: p.url,
      text: p.text.slice(0, 2_000),
      postedAt: p.postedAt,
      sentiment: p.sentiment,
      likes: p.likes,
      replies: p.replies,
      reposts: p.reposts,
      views: p.views,
    }))
  const matrixPos = actorMatrixPos(actor, scored.config)
  return {
    actor: {
      id: actor.id,
      handle: actor.handle,
      displayName: actor.displayName,
      followers: actor.followers,
      postsVolume: actor.postsVolume,
      qualityScore: actor.qualityScore,
      volumeScore: actor.volumeScore,
      sentiment: actor.sentiment,
      quadrant: actor.quadrant,
      avatarUrl: actor.avatarUrl,
    },
    mapRank: mapKol?.rank || actor.mapRank || null,
    matrix: {
      x: matrixPos.x,
      y: matrixPos.y,
      volumeSplit: scored.config.volumeSplit,
      qualitySplit: scored.config.qualitySplit,
    },
    posts,
    source: {
      scexAsOf: scex.asOf,
      scexUpdatedAt: scex.updatedAt || null,
      kolsUpdatedAt: kols.updatedAt || null,
    },
  }
}
