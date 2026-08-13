import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'

/** Trim + strip accidental wrapping quotes from Vercel UI paste. */
export function env(name: string): string {
  const v = process.env[name]
  if (!v) return ''
  return v.trim().replace(/^["']|["']$/g, '')
}

export function envPresence() {
  return {
    R2_ACCOUNT_ID: !!env('R2_ACCOUNT_ID'),
    R2_ACCESS_KEY_ID: !!env('R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY: !!env('R2_SECRET_ACCESS_KEY'),
    R2_BUCKET_NAME: !!env('R2_BUCKET_NAME'),
    R2_PUBLIC_BASE_URL: !!(env('R2_PUBLIC_BASE_URL') || env('R2_PUBLIC_URL')),
    FEED_ADMIN_TOKEN: !!env('FEED_ADMIN_TOKEN'),
    VERCEL_ENV: process.env.VERCEL_ENV || null,
  }
}

export function r2Configured(): boolean {
  return !!(
    env('R2_ACCOUNT_ID') &&
    env('R2_ACCESS_KEY_ID') &&
    env('R2_SECRET_ACCESS_KEY') &&
    env('R2_BUCKET_NAME')
  )
}

export function r2Client(): S3Client | null {
  if (!r2Configured()) return null
  const accountId = env('R2_ACCOUNT_ID')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  })
}

export function r2Bucket(): string {
  return env('R2_BUCKET_NAME')
}

/**
 * Optional public CDN/base URL for media.
 * Supports daveynfts.com naming: R2_PUBLIC_URL (alias of R2_PUBLIC_BASE_URL).
 */
export function r2PublicBase(): string {
  return (env('R2_PUBLIC_BASE_URL') || env('R2_PUBLIC_URL')).replace(/\/$/, '')
}

export const FEED_OBJECT_KEY = 'feed/v1.json'
/** Shared KOL list (admin edits) — same bucket, different key */
export const KOLS_OBJECT_KEY = 'kols/v1.json'
/** Smart / recent followers map (admin edits) */
export const RECENT_FOLLOWERS_OBJECT_KEY = 'recent-followers/v1.json'
/** Internal TwitterScore Top 100 benchmark (admin-editable) */
export const TWITTERSCORE_TOP100_OBJECT_KEY = 'internal/twitterscore-top100/v1.json'
/** SCEX partner tracking (matrix + livefeed) — admin-editable */
export const SCEX_TRACKING_OBJECT_KEY = 'scex/tracking/v1.json'
/** KOL evaluation reports (text from DOCX) + changelog — admin-editable */
export const KOL_REPORTS_OBJECT_KEY = 'internal/kol-reports/v1.json'
/** Partner event ribbon (text + image URLs) — admin-editable */
export const SITE_BANNER_OBJECT_KEY = 'site/banner/v1.json'
/** Conviction 2026 side-event map — admin-editable */
export const EVENT_SIDE_EVENTS_OBJECT_KEY = 'events/conviction-2026/v1.json'
/** Prefix for banner image uploads (logo, art background) */
export const BANNER_IMAGES_PREFIX = 'scex-banner'

/**
 * Prefixes the site may proxy via `/r2/*`. JSON admin keys must never be
 * listed here — they are served only through `/api/*`.
 *
 * The Cloudflare R2 “Public Development URL” (pub-*.r2.dev) exposes every
 * object in the bucket. Disable that URL in the R2 dashboard after media is
 * served via `/r2/*` rewrites + `/api/r2-public`, or JSON keys leak.
 */
export const R2_PUBLIC_MEDIA_PREFIXES = [
  'radar/',
  'media/',
  'scex-banner/',
  'kol-reports/',
  'RadarKOLsReport/',
] as const

export function isPublicMediaKey(key: string): boolean {
  const k = String(key || '').replace(/^\/+/, '')
  if (!k || k.includes('..')) return false
  if (/\.json$/i.test(k)) return false
  if (k.startsWith('internal/')) return false
  return R2_PUBLIC_MEDIA_PREFIXES.some((p) => k.startsWith(p))
}

export class R2PreconditionError extends Error {
  override name = 'R2PreconditionError'
}

export function isR2NotFound(e: unknown): boolean {
  const name = (e as { name?: string })?.name
  if (name === 'NoSuchKey' || name === 'NotFound') return true
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode
  return status === 404
}

export function isR2PreconditionFailed(e: unknown): boolean {
  if (e instanceof R2PreconditionError) return true
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode
  return status === 412 || status === 409
}

export function bannerImageObjectKey(
  slot: 'logo' | 'art',
  ext: string,
): string {
  const base = slot === 'logo' ? 'scex-logo' : 'x-banner'
  const e = ext.replace(/^\./, '').toLowerCase()
  return `${BANNER_IMAGES_PREFIX}/${base}.${e}`
}

export function mediaObjectKey(id: string) {
  return `media/${id}`
}

export function mediaPublicUrl(id: string, _contentType?: string): string {
  const base = r2PublicBase()
  if (base) {
    // Prefer extension-less key; browser uses content-type from R2
    return `${base}/${mediaObjectKey(id)}`
  }
  // Proxy through our API (works with private bucket)
  return `/api/media?id=${encodeURIComponent(id)}`
}

export type R2JsonMeta<T> = { data: T; etag?: string }

export async function r2GetJsonMeta<T>(
  client: S3Client,
  key: string,
): Promise<R2JsonMeta<T> | null> {
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    )
    const text = await out.Body?.transformToString()
    if (!text) return null
    return { data: JSON.parse(text) as T, etag: out.ETag }
  } catch (e: unknown) {
    if (isR2NotFound(e)) return null
    throw e
  }
}

export async function r2PutJson(
  client: S3Client,
  key: string,
  data: unknown,
  opts?: { ifMatch?: string },
): Promise<void> {
  const body = JSON.stringify(data)
  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: key,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
  })
  if (opts?.ifMatch) {
    const etag = opts.ifMatch
    command.middlewareStack.add(
      (next) => async (args) => {
        const req = args.request as { headers?: Record<string, string> }
        if (req.headers) req.headers['if-match'] = etag
        return next(args)
      },
      { step: 'build', name: 'r2IfMatch' },
    )
  }
  try {
    await client.send(command)
  } catch (e: unknown) {
    if (isR2PreconditionFailed(e)) {
      throw new R2PreconditionError('R2 If-Match failed')
    }
    throw e
  }
}

export async function r2GetJson<T>(
  client: S3Client,
  key: string,
): Promise<T | null> {
  const meta = await r2GetJsonMeta<T>(client, key)
  return meta ? meta.data : null
}

export async function r2PutBytes(
  client: S3Client,
  key: string,
  body: Buffer,
  contentType: string,
  /** Override default week-immutable cache (use short TTL for overwritable assets) */
  cacheControl?: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl:
        cacheControl || 'public, max-age=604800, immutable',
    }),
  )
}

export async function r2GetObject(
  client: S3Client,
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    )
    const bytes = await out.Body?.transformToByteArray()
    if (!bytes) return null
    return {
      body: Buffer.from(bytes),
      contentType: out.ContentType || 'application/octet-stream',
    }
  } catch (e: unknown) {
    if (isR2NotFound(e)) return null
    throw e
  }
}

export async function r2Exists(client: S3Client, key: string): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    )
    return true
  } catch (e: unknown) {
    if (isR2NotFound(e)) return false
    throw e
  }
}

export async function r2Delete(client: S3Client, key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
    }),
  )
}
