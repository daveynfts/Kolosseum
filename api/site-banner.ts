/**
 * Partner event ribbon — JSON config + image upload (one Hobby function).
 *
 * GET  /api/site-banner              — public read config
 * PUT  /api/site-banner              — Bearer JSON config replace
 * PUT  /api/site-banner?slot=logo|art — Bearer raw image bytes → R2
 *
 * R2: site/banner/v1.json · scex-banner/scex-logo.* · scex-banner/x-banner.*
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  bannerImageObjectKey,
  BANNER_IMAGES_PREFIX,
  envPresence,
  SITE_BANNER_OBJECT_KEY,
  r2Client,
  r2GetJson,
  r2PublicBase,
  r2PutBytes,
} from '../lib/server/r2.js'
import {
  commitJsonReplace,
  cors,
  enforcePublicRateLimit,
  isGetOrHead,
  jsonError,
  parseJsonBody,
  requireAdmin,
  sendJson,
} from '../lib/server/apiHelpers.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

type Body = {
  version?: number
  kind?: string
  enabled?: boolean
  href?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  pill?: string
  cta?: string
  ariaLabel?: string
  logoUrl?: string
  artUrl?: string
  updatedAt?: string
  note?: string
  [k: string]: unknown
}

const MAX_BYTES = 4.5 * 1024 * 1024
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function isValidBody(body: Body): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    typeof body.href === 'string' &&
    typeof body.title === 'string'
  )
}

function extFromType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

function snifContentType(body: Buffer, hinted: string): string | null {
  if (body.length >= 8) {
    if (
      body[0] === 0x89 &&
      body[1] === 0x50 &&
      body[2] === 0x4e &&
      body[3] === 0x47
    )
      return 'image/png'
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
      return 'image/jpeg'
    if (
      body[0] === 0x47 &&
      body[1] === 0x49 &&
      body[2] === 0x46 &&
      body[3] === 0x38
    )
      return 'image/gif'
    if (
      body[0] === 0x52 &&
      body[1] === 0x49 &&
      body[2] === 0x46 &&
      body[3] === 0x46 &&
      body[8] === 0x57 &&
      body[9] === 0x45 &&
      body[10] === 0x42 &&
      body[11] === 0x50
    )
      return 'image/webp'
  }
  const h = (hinted || '').toLowerCase().split(';')[0].trim()
  if (ALLOWED.has(h)) return h === 'image/jpg' ? 'image/jpeg' : h
  return null
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const raw = req.body
  if (raw && (Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
    return Buffer.from(raw)
  }
  if (typeof raw === 'string' && raw.length > 0) {
    if (raw.startsWith('data:') && raw.includes('base64,')) {
      const b64 = raw.split('base64,')[1] || ''
      return Buffer.from(b64, 'base64')
    }
    // JSON PUTs arrive as string — not image bytes
    if (raw.trim().startsWith('{')) return Buffer.alloc(0)
    return Buffer.from(raw, 'binary')
  }
  // Parsed JSON object from bodyParser — not an image upload
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    return Buffer.alloc(0)
  }
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  return Buffer.concat(chunks)
}

function isImagePut(req: VercelRequest): boolean {
  const ct = String(req.headers['content-type'] || '')
    .toLowerCase()
    .split(';')[0]
    .trim()
  if (ct === 'application/json' || ct.startsWith('text/')) return false
  const slot = String(req.query.slot || '').toLowerCase()
  if (slot !== 'logo' && slot !== 'art') return false
  return (
    ct.startsWith('image/') ||
    ct === 'application/octet-stream' ||
    ct === ''
  )
}

async function handleImagePut(
  req: VercelRequest,
  res: VercelResponse,
  client: NonNullable<ReturnType<typeof r2Client>>,
) {
  const slotRaw = String(req.query.slot || '').toLowerCase()
  if (slotRaw !== 'logo' && slotRaw !== 'art') {
    return jsonError(res, 400, 'invalid_slot', {
      message: 'Use ?slot=logo or ?slot=art',
    })
  }
  const slot = slotRaw as 'logo' | 'art'
  const body = await readRawBody(req)
  if (!body.length || body.length < 24) {
    return jsonError(res, 400, 'empty_body', {
      message: 'Upload raw image bytes',
    })
  }
  if (body.length > MAX_BYTES) {
    return jsonError(res, 413, 'too_large', {
      message: `Max ${MAX_BYTES} bytes`,
      bytes: body.length,
    })
  }
  const hinted = String(req.headers['content-type'] || '')
  const contentType = snifContentType(body, hinted)
  if (!contentType) {
    return jsonError(res, 415, 'invalid_image', {
      message: 'Only PNG, JPEG, WebP, GIF allowed',
    })
  }
  const ext = extFromType(contentType)
  const key = bannerImageObjectKey(slot, ext)
  await r2PutBytes(
    client,
    key,
    body,
    contentType,
    'public, max-age=120, must-revalidate',
  )
  const publicBase = r2PublicBase()
  const encoded = key
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')
  const baseUrl = publicBase ? `${publicBase}/${encoded}` : `/r2/${encoded}`
  const url = `${baseUrl}?v=${Date.now()}`
  return res.status(200).json({
    ok: true,
    key,
    url,
    slot,
    bytes: body.length,
    contentType,
    storage: 'r2',
    prefix: BANNER_IMAGES_PREFIX,
    publicBase: publicBase || null,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, 'GET, HEAD, PUT, OPTIONS', 'Content-Type, Authorization, X-Filename')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const client = r2Client()
  if (!client) {
    return jsonError(res, 503, 'r2_not_configured', {
      message: 'Cloudflare R2 not configured.',
      env: envPresence(),
    })
  }

  try {
    if (isGetOrHead(req.method)) {
      if (!enforcePublicRateLimit(req, res, 'site-banner', 90)) return
      const data = await r2GetJson<Body>(client, SITE_BANNER_OBJECT_KEY)
      if (!data || typeof data.href !== 'string') {
        return sendJson(req, res, 404, {
          error: 'empty',
          message: 'No banner config on server yet. Admin → Banner → Save.',
        })
      }
      return sendJson(req, res, 200, data)
    }

    if (req.method === 'PUT') {
      if (!requireAdmin(req, res)) return

      // Image upload branch (was /api/banner-image)
      if (isImagePut(req)) {
        return handleImagePut(req, res, client)
      }

      const parsed = parseJsonBody<Body>(req)
      if (parsed.ok === false) {
        return jsonError(res, 400, parsed.error, {
          message: 'Need href and title at minimum (or ?slot=logo|art for images)',
        })
      }
      const body = parsed.body
      if (!isValidBody(body)) {
        return jsonError(res, 400, 'invalid_body', {
          message: 'Need href and title at minimum (or ?slot=logo|art for images)',
        })
      }
      const payload: Body = {
        ...body,
        version: body.version ?? 1,
        kind: 'site-banner',
        enabled: body.enabled !== false,
        updatedAt: new Date().toISOString(),
      }
      delete (payload as { baseUpdatedAt?: string }).baseUpdatedAt
      if (
        !(await commitJsonReplace(
          res,
          client,
          SITE_BANNER_OBJECT_KEY,
          body as Record<string, unknown>,
          (current) => current?.updatedAt,
          'Server có banner mới hơn. Reload rồi Save lại.',
          payload,
        ))
      ) {
        return
      }
      return res.status(200).json({
        ok: true,
        enabled: payload.enabled,
        updatedAt: payload.updatedAt,
        storage: 'r2',
        key: SITE_BANNER_OBJECT_KEY,
      })
    }

    return jsonError(res, 405, 'method_not_allowed')
  } catch (e) {
    console.error('[api/site-banner]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : 'unknown',
    })
  }
}
