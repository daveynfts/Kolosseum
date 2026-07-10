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

export function mediaObjectKey(id: string) {
  return `media/${id}`
}

export function mediaPublicUrl(id: string, contentType?: string): string {
  const base = r2PublicBase()
  if (base) {
    // Prefer extension-less key; browser uses content-type from R2
    return `${base}/${mediaObjectKey(id)}`
  }
  // Proxy through our API (works with private bucket)
  return `/api/media?id=${encodeURIComponent(id)}`
}

export async function r2PutJson(
  client: S3Client,
  key: string,
  data: unknown,
): Promise<void> {
  const body = JSON.stringify(data)
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-store',
    }),
  )
}

export async function r2GetJson<T>(
  client: S3Client,
  key: string,
): Promise<T | null> {
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      }),
    )
    const text = await out.Body?.transformToString()
    if (!text) return null
    return JSON.parse(text) as T
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name
    if (name === 'NoSuchKey' || name === 'NotFound') return null
    // AWS SDK v3 NotFound
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode
    if (status === 404) return null
    throw e
  }
}

export async function r2PutBytes(
  client: S3Client,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=604800, immutable',
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
    const name = (e as { name?: string })?.name
    if (name === 'NoSuchKey' || name === 'NotFound') return null
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode
    if (status === 404) return null
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
  } catch {
    return false
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
