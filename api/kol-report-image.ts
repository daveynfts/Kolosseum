/**
 * Upload assets to R2 (KOL report images + Surf PDFs) — one Hobby function.
 *
 * PUT /api/kol-report-image?filename=…&overwrite=1
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw image bytes
 *
 * PUT /api/kol-report-image?kind=surf&filename=Report.pdf
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw PDF bytes  (was /api/surf-report)
 *
 * Default: unique key (legacy one-shot uploads).
 * overwrite=1: stable path under kol-reports/images/{reportId}/{slot}.ext
 *   — re-upload replaces the same R2 object (no duplicate files).
 *
 * Returns { ok, key, url, bytes, contentType, storage, overwritten }
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
    // Raw binary PUT — parser would corrupt image bytes / break magic sniff
    bodyParser: false,
  },
}

/** Always under this R2 prefix — durable public CDN path */
const PREFIX = 'kol-reports/images'
const SURF_PREFIX = 'RadarKOLsReport'
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
    'Content-Type, Authorization, X-Filename, X-Overwrite',
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

/** One-shot unique name (no overwrite) */
function uniqueFilename(raw: string, contentType: string): string {
  let base = (raw || '').trim().replace(/\\/g, '/')
  base = base.split('/').pop() || ''
  base = base.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_').replace(/\s+/g, '_')
  const ext = extFromType(contentType)
  let stem = base.replace(/\.(png|jpe?g|webp|gif)$/i, '') || 'img'
  if (stem.length > 80) stem = stem.slice(0, 80)
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return `${stem}_${stamp}.${ext}`
}

/**
 * Stable relative path: {reportId}/{slot}.ext
 * Re-upload with same path replaces object on R2.
 */
function stableFilename(raw: string, contentType: string): string | null {
  let path = (raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!path) return null
  const parts = path.split('/').filter(Boolean)
  const ext = extFromType(contentType)

  const cleanSeg = (s: string) =>
    s.replace(/[^\w.\-]/g, '_').replace(/_+/g, '_').slice(0, 64)

  if (parts.length === 1) {
    let file = cleanSeg(parts[0])
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) file = `${file}.${ext}`
    else file = file.replace(/\.(png|jpe?g|webp|gif)$/i, `.${ext}`)
    return file
  }

  if (parts.length >= 2) {
    // reportId / slot (ignore deeper paths)
    const folder = cleanSeg(parts[0])
    let file = cleanSeg(parts[parts.length - 1])
    if (!folder || folder === '_' || folder === 'undefined') return null
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) file = `${file}.${ext}`
    else file = file.replace(/\.(png|jpe?g|webp|gif)$/i, `.${ext}`)
    return `${folder}/${file}`
  }
  return null
}

function sanitizeSurfFilename(raw: string): string {
  let name = (raw || 'report.pdf').trim().replace(/\\/g, '/')
  name = name.split('/').pop() || 'report.pdf'
  name = name.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_')
  name = name.replace(/\s+/g, '_')
  if (/\.docx$/i.test(name)) {
    name = name.replace(/\.docx$/i, '.pdf')
  }
  if (!/\.pdf$/i.test(name)) {
    name = `${name.replace(/\.[^.]+$/, '') || 'report'}.pdf`
  }
  if (name.length > 180) {
    name = name.slice(0, 170) + '.pdf'
  }
  return name
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  // Prefer streaming the request (bodyParser: false). Fall back if already buffered.
  const raw = req.body
  if (raw && (Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
    return Buffer.from(raw)
  }
  if (typeof raw === 'string' && raw.length > 0) {
    if (raw.startsWith('data:') && raw.includes('base64,')) {
      const b64 = raw.split('base64,')[1] || ''
      return Buffer.from(b64, 'base64')
    }
    // latin1 preserves byte values 0–255 (utf8 would corrupt binary)
    return Buffer.from(raw, 'latin1')
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
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
    const kind = String(req.query.kind || '').toLowerCase()
    const body = await readRawBody(req)
    const looksPdf =
      body.length >= 4 &&
      body[0] === 0x25 &&
      body[1] === 0x50 &&
      body[2] === 0x44 &&
      body[3] === 0x46

    // ── Surf PDF branch (formerly /api/surf-report) ─────────────
    if (
      kind === 'surf' ||
      kind === 'surf-report' ||
      kind === 'pdf' ||
      looksPdf
    ) {
      const qName = String(req.query.filename || req.query.name || '')
      const hName = String(req.headers['x-filename'] || '')
      const rawName = (qName || hName || '').toLowerCase()
      if (rawName.endsWith('.docx') || rawName.includes('.docx')) {
        return res.status(415).json({
          error: 'docx_not_allowed',
          message:
            'Chỉ nhận PDF. Export/convert DOCX → PDF rồi upload lại (không upload .docx lên R2).',
        })
      }
      const filename = sanitizeSurfFilename(qName || hName || 'report.pdf')
      const key = `${SURF_PREFIX}/${filename}`
      if (!body.length || body.length < 64) {
        return res.status(400).json({
          error: 'empty_body',
          message: 'Upload raw PDF bytes in request body',
        })
      }
      if (body.length > MAX_BYTES) {
        return res.status(413).json({
          error: 'too_large',
          message: `Max ${MAX_BYTES} bytes`,
          bytes: body.length,
        })
      }
      const isPdf =
        body[0] === 0x25 &&
        body[1] === 0x50 &&
        body[2] === 0x44 &&
        body[3] === 0x46
      const isZip = body[0] === 0x50 && body[1] === 0x4b
      if (isZip || !isPdf) {
        return res.status(415).json({
          error: isZip ? 'docx_not_allowed' : 'invalid_file',
          message: isZip
            ? 'DOCX/ZIP không được upload. Chỉ PDF (magic %PDF).'
            : 'Expected a PDF file (starts with %PDF)',
        })
      }
      await r2PutBytes(client, key, body, 'application/pdf')
      const publicBase = r2PublicBase()
      const encoded = key
        .split('/')
        .map((s) => encodeURIComponent(s))
        .join('/')
      const url = publicBase ? `${publicBase}/${encoded}` : `/r2/${encoded}`
      return res.status(200).json({
        ok: true,
        key,
        filename,
        bytes: body.length,
        contentType: 'application/pdf',
        url,
        prefix: SURF_PREFIX,
        storage: 'r2',
      })
    }

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
    // Prefer header for paths with "/" — some proxies mangle %2F in query strings
    const rawName = hName || qName
    const overwrite =
      String(req.query.overwrite || '') === '1' ||
      String(req.query.overwrite || '').toLowerCase() === 'true' ||
      String(req.headers['x-overwrite'] || '') === '1'

    let rel: string
    let wasOverwrite = false
    if (overwrite) {
      const reportId = String(req.query.reportId || '').trim()
      const slot = String(req.query.slot || '').trim()
      const extQ = String(req.query.ext || '')
        .trim()
        .replace(/^\./, '')
      const fromParts =
        reportId && slot
          ? stableFilename(
              `${reportId}/${slot}${extQ ? `.${extQ}` : ''}`,
              contentType,
            )
          : null
      const stable = fromParts || stableFilename(rawName, contentType)
      if (!stable) {
        return res.status(400).json({
          error: 'invalid_stable_path',
          message:
            'overwrite=1 requires reportId+slot query params, or filename/X-Filename like {reportId}/cover.png',
        })
      }
      rel = stable
      wasOverwrite = true
    } else {
      rel = uniqueFilename(rawName, contentType)
    }

    const key = `${PREFIX}/${rel}`

    // Short cache when overwriting so re-edit shows new bytes; unique still long-lived
    await r2PutBytes(
      client,
      key,
      body,
      contentType,
      wasOverwrite
        ? 'public, max-age=120, must-revalidate'
        : 'public, max-age=604800, immutable',
    )

    const publicBase = r2PublicBase()
    const encoded = key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')
    const baseUrl = publicBase ? `${publicBase}/${encoded}` : `/r2/${encoded}`
    // Cache-bust query so browser picks up overwritten object immediately
    const url = wasOverwrite ? `${baseUrl}?v=${Date.now()}` : baseUrl

    return res.status(200).json({
      ok: true,
      key,
      url,
      filename: rel,
      bytes: body.length,
      contentType,
      storage: 'r2',
      prefix: PREFIX,
      overwritten: wasOverwrite,
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
