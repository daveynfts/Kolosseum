/**
 * Upload Surf report PDF to R2 prefix RadarKOLsReport/.
 * DOCX is not accepted — convert to PDF before upload.
 *
 * PUT /api/surf-report?filename=Report.pdf
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw PDF bytes
 *   Content-Type: application/pdf | application/octet-stream
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

/** Vercel serverless request body soft limit ~4.5MB */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

const PREFIX = 'RadarKOLsReport'
const MAX_BYTES = 4.5 * 1024 * 1024

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

function sanitizeFilename(raw: string): string {
  let name = (raw || 'report.pdf').trim().replace(/\\/g, '/')
  // strip path segments — only basename
  name = name.split('/').pop() || 'report.pdf'
  name = name.replace(/[^\w.\-()+\s\u00C0-\u024F]/g, '_')
  name = name.replace(/\s+/g, '_')
  // Force .pdf — reject .docx names (replace extension)
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
  const raw = req.body
  if (raw && (Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
    return Buffer.from(raw)
  }
  if (typeof raw === 'string' && raw.length > 0) {
    // base64 wrapper: data:...;base64,XXXX
    if (raw.startsWith('data:') && raw.includes('base64,')) {
      const b64 = raw.split('base64,')[1] || ''
      return Buffer.from(b64, 'base64')
    }
    return Buffer.from(raw, 'binary')
  }
  // Stream (bodyParser: false)
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
    const qName = String(req.query.filename || req.query.name || '')
    const hName = String(req.headers['x-filename'] || '')
    // Explicit reject of docx before sanitize renames
    const rawName = (qName || hName || '').toLowerCase()
    if (rawName.endsWith('.docx') || rawName.includes('.docx')) {
      return res.status(415).json({
        error: 'docx_not_allowed',
        message:
          'Chỉ nhận PDF. Export/convert DOCX → PDF rồi upload lại (không upload .docx lên R2).',
      })
    }

    const filename = sanitizeFilename(qName || hName || 'report.pdf')
    const key = `${PREFIX}/${filename}`

    const body = await readRawBody(req)
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

    // Magic bytes: PDF only (%PDF). DOCX is ZIP (PK) — reject.
    const isPdf =
      body[0] === 0x25 &&
      body[1] === 0x50 &&
      body[2] === 0x44 &&
      body[3] === 0x46 // %PDF
    const isZip = body[0] === 0x50 && body[1] === 0x4b // DOCX/ZIP
    if (isZip || !isPdf) {
      return res.status(415).json({
        error: isZip ? 'docx_not_allowed' : 'invalid_file',
        message: isZip
          ? 'DOCX/ZIP không được upload. Chỉ PDF (magic %PDF).'
          : 'Expected a PDF file (starts with %PDF)',
      })
    }

    const contentType = 'application/pdf'
    await r2PutBytes(client, key, body, contentType)

    const publicBase = r2PublicBase()
    const url = publicBase
      ? `${publicBase}/${key
          .split('/')
          .map((s) => encodeURIComponent(s))
          .join('/')}`
      : `/r2/${key
          .split('/')
          .map((s) => encodeURIComponent(s))
          .join('/')}`

    return res.status(200).json({
      ok: true,
      key,
      filename,
      bytes: body.length,
      contentType,
      url,
      prefix: PREFIX,
    })
  } catch (e) {
    console.error('[api/surf-report PUT]', e)
    return res.status(500).json({
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
