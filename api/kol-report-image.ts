/**
 * Upload KOL report image to R2 for markdown embedding.
 *
 * PUT /api/kol-report-image?filename=chart.png
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw image bytes (or data-url base64 string)
 *   Content-Type: image/png | image/jpeg | image/webp | image/gif
 *
 * Returns { ok, key, url, bytes, contentType }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  envPresence,
  r2Client,
  r2Configured,
  r2PublicBase,
  r2PutBytes,
} from '../lib/server/r2.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

/** Always under this R2 prefix — durable public CDN path */
const PREFIX = 'kol-reports/images'
const MAX_BYTES = 4.5 * 1024 * 1024
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Filename',
  )
  res.setHeader('Cache-Control', 'no-store')
}

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
    // PNG
    if (
      body[0] === 0x89 &&
      body[1] === 0x50 &&
      body[2] === 0x4e &&
      body[3] === 0x47
    )
      return 'image/png'
    // JPEG
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
      return 'image/jpeg'
    // GIF
    if (
      body[0] === 0x47 &&
      body[1] === 0x49 &&
      body[2] === 0x46 &&
      body[3] === 0x38
    )
      return 'image/gif'
    // WEBP (RIFF....WEBP)
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

/**
 * Unique R2 object name — never overwrite prior uploads.
 * e.g. chart_mryd9abc_k3f2.png
 */
function uniqueFilename(raw: string, contentType: string): string {
  let base = (raw || '').trim().replace(/\\/g, '/')
  base = base.split('/').pop() || ''
  base = base.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_').replace(/\s+/g, '_')
  const ext = extFromType(contentType)
  // strip extension for stem
  let stem = base.replace(/\.(png|jpe?g|webp|gif)$/i, '') || 'img'
  if (stem.length > 80) stem = stem.slice(0, 80)
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return `${stem}_${stamp}.${ext}`
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
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  if (!r2Configured()) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message: 'Set R2_* env on Vercel',
      env: envPresence(),
    })
  }
  const client = r2Client()
  if (!client) {
    return res.status(503).json({ error: 'r2_not_configured' })
  }

  const secret = env('FEED_ADMIN_TOKEN')
  if (!secret) {
    return res.status(503).json({ error: 'token_not_configured' })
  }
  if (bearer(req) !== secret) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const body = await readRawBody(req)
    if (!body.length || body.length < 24) {
      return res.status(400).json({
        error: 'empty_body',
        message: 'Upload raw image bytes',
      })
    }
    if (body.length > MAX_BYTES) {
      return res.status(413).json({
        error: 'too_large',
        message: `Max ${MAX_BYTES} bytes`,
        bytes: body.length,
      })
    }

    const hinted = String(req.headers['content-type'] || '')
    const contentType = snifContentType(body, hinted)
    if (!contentType) {
      return res.status(415).json({
        error: 'invalid_image',
        message: 'Only PNG, JPEG, WebP, GIF allowed',
      })
    }

    const qName = String(req.query.filename || req.query.name || '')
    const hName = String(req.headers['x-filename'] || '')
    const filename = uniqueFilename(qName || hName, contentType)
    const key = `${PREFIX}/${filename}`

    // Durable write to Cloudflare R2 (same bucket as feed/media)
    await r2PutBytes(client, key, body, contentType)

    const publicBase = r2PublicBase()
    const encoded = key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')
    // Prefer public CDN URL; fallback /r2/ rewrite for private buckets
    const url = publicBase ? `${publicBase}/${encoded}` : `/r2/${encoded}`

    return res.status(200).json({
      ok: true,
      key,
      url,
      filename,
      bytes: body.length,
      contentType,
      storage: 'r2',
      prefix: PREFIX,
      publicBase: publicBase || null,
    })
  } catch (e) {
    console.error('[api/kol-report-image]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
