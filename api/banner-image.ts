/**
 * Upload partner banner images to R2 (stable overwrite per slot).
 *
 * PUT /api/banner-image?slot=logo|art
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw image bytes
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  bannerImageObjectKey,
  BANNER_IMAGES_PREFIX,
  env,
  envPresence,
  r2Client,
  r2Configured,
  r2PublicBase,
  r2PutBytes,
} from '../lib/server/r2.js'
import { cors, jsonError } from '../lib/server/apiHelpers.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

const MAX_BYTES = 4.5 * 1024 * 1024
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function bearer(req: VercelRequest): string {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ') || h.startsWith('bearer ')) return h.slice(7).trim()
  return ''
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
    return Buffer.from(raw, 'binary')
  }
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, 'PUT, OPTIONS', 'Content-Type, Authorization, X-Filename')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'PUT') {
    return jsonError(res, 405, 'method_not_allowed')
  }

  if (!r2Configured()) {
    return jsonError(res, 503, 'r2_not_configured', { env: envPresence() })
  }
  const client = r2Client()
  if (!client) {
    return jsonError(res, 503, 'r2_not_configured')
  }

  const secret = env('FEED_ADMIN_TOKEN')
  if (!secret) {
    return jsonError(res, 503, 'token_not_configured')
  }
  if (bearer(req) !== secret) {
    return jsonError(res, 401, 'unauthorized')
  }

  const slotRaw = String(req.query.slot || '').toLowerCase()
  if (slotRaw !== 'logo' && slotRaw !== 'art') {
    return jsonError(res, 400, 'invalid_slot', {
      message: 'Use ?slot=logo or ?slot=art',
    })
  }
  const slot = slotRaw as 'logo' | 'art'

  try {
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
  } catch (e) {
    console.error('[api/banner-image]', e)
    return jsonError(res, 500, 'server_error', {
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
