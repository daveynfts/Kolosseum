/**
 * Upload / refresh KOL avatars on R2 (radar/avatars/{handle}.jpg).
 *
 * PUT /api/avatar?handle=mingli0x
 *   Authorization: Bearer FEED_ADMIN_TOKEN
 *   Body: raw image bytes (image/jpeg|png|webp) OR empty to fetch from X via fxtwitter
 *
 * GET /api/avatar?handle=mingli0x — public proxy if needed
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  env,
  r2Client,
  r2Configured,
  r2GetObject,
  r2PutBytes,
  r2PublicBase,
} from '../lib/server/r2.js'

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Cache-Control', 'no-store')
}

function bearer(req: VercelRequest): string {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ') || h.startsWith('bearer ')) return h.slice(7).trim()
  return ''
}

function avatarKey(handle: string): string {
  const clean = handle.replace(/^@/, '').trim().replace(/[?#%\\/]/g, '')
  return `radar/avatars/${clean}.jpg`
}

/**
 * Build candidate twimg URLs. Some accounts return tiny _normal PNGs
 * and broken _400x400 variants; original (no size suffix) is often larger.
 */
function twimgCandidates(url: string): string[] {
  const base = url.split('?')[0]
  const stripped = base
    .replace(/_normal(\.[a-zA-Z0-9]+)$/i, '$1')
    .replace(/_bigger(\.[a-zA-Z0-9]+)$/i, '$1')
    .replace(/_mini(\.[a-zA-Z0-9]+)$/i, '$1')
    .replace(/_x96(\.[a-zA-Z0-9]+)$/i, '$1')
    .replace(/_200x200(\.[a-zA-Z0-9]+)$/i, '$1')
    .replace(/_400x400(\.[a-zA-Z0-9]+)$/i, '$1')
  const list = [
    base.replace(/_normal\./i, '_400x400.'),
    base.replace(/_bigger\./i, '_400x400.'),
    base.replace(/_mini\./i, '_400x400.'),
    stripped,
    base,
  ]
  return [...new Set(list.filter(Boolean))]
}

const MIN_AVATAR_BYTES = 400

async function downloadImage(
  url: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const imgRes = await fetch(url, {
      headers: { Accept: 'image/*', 'User-Agent': 'vn-kol-radar/1.0' },
    })
    if (!imgRes.ok) return null
    const ab = await imgRes.arrayBuffer()
    const body = Buffer.from(ab)
    if (body.length < MIN_AVATAR_BYTES) return null
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    return { body, contentType }
  } catch {
    return null
  }
}

async function fetchXAvatar(handle: string): Promise<{
  body: Buffer
  contentType: string
} | null> {
  const h = handle.replace(/^@/, '').trim()
  for (const host of ['api.fxtwitter.com', 'api.vxtwitter.com']) {
    try {
      const res = await fetch(`https://${host}/${encodeURIComponent(h)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'vn-kol-radar/1.0' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        user?: Record<string, unknown>
      }
      const user = data.user || (data as Record<string, unknown>)
      const img =
        (user.avatar_url as string) ||
        (user.profile_image_url_https as string) ||
        (user.avatar as string) ||
        ''
      if (!img || !/^https?:\/\//i.test(img)) continue
      for (const candidate of twimgCandidates(img)) {
        const got = await downloadImage(candidate)
        if (got) return got
      }
    } catch {
      continue
    }
  }
  // unavatar fallback
  for (const path of [
    `https://unavatar.io/x/${encodeURIComponent(h)}`,
    `https://unavatar.io/twitter/${encodeURIComponent(h)}`,
  ]) {
    const got = await downloadImage(path)
    if (got) return got
  }
  return null
}

/** Accept raw image uploads (PNG/JPEG/WebP) up to ~2MB */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const handle = String(req.query.handle || '')
    .replace(/^@/, '')
    .trim()
  if (!handle || !/^[A-Za-z0-9_]{1,30}$/.test(handle)) {
    return res.status(400).json({ error: 'invalid_handle' })
  }

  if (!r2Configured()) {
    return res.status(503).json({
      error: 'r2_not_configured',
      message: 'Set R2_* env on Vercel',
    })
  }
  const client = r2Client()
  if (!client) {
    return res.status(503).json({ error: 'r2_not_configured' })
  }

  const key = avatarKey(handle)

  if (req.method === 'GET') {
    try {
      const obj = await r2GetObject(client, key)
      if (!obj) return res.status(404).json({ error: 'not_found' })
      res.setHeader('Content-Type', obj.contentType || 'image/jpeg')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(obj.body)
    } catch (e) {
      console.error('[api/avatar GET]', e)
      return res.status(500).json({ error: 'server_error' })
    }
  }

  if (req.method === 'PUT') {
    const secret = env('FEED_ADMIN_TOKEN')
    if (!secret) {
      return res.status(503).json({ error: 'token_not_configured' })
    }
    if (bearer(req) !== secret) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    try {
      let body: Buffer | null = null
      let contentType = 'image/jpeg'

      // Vercel may parse body as Buffer / base64 string / { data }
      const raw = req.body
      if (raw && (Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
        body = Buffer.from(raw)
        contentType =
          String(req.headers['content-type'] || 'image/jpeg').split(';')[0] ||
          'image/jpeg'
      } else if (typeof raw === 'string' && raw.length > 100) {
        // raw binary string or data-url / base64
        if (raw.startsWith('data:image/')) {
          const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
          if (m) {
            contentType = m[1]
            body = Buffer.from(m[2], 'base64')
          }
        } else if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw.slice(0, 80)) && raw.length > 400) {
          body = Buffer.from(raw.replace(/\s/g, ''), 'base64')
          contentType =
            String(req.headers['content-type'] || 'image/jpeg').split(';')[0] ||
            'image/jpeg'
        } else {
          body = Buffer.from(raw, 'binary')
          contentType =
            String(req.headers['content-type'] || 'image/jpeg').split(';')[0] ||
            'image/jpeg'
        }
      } else if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
        const d = (raw as { data?: string; contentType?: string }).data
        if (typeof d === 'string' && d.length > 100) {
          body = Buffer.from(d, 'base64')
          contentType =
            (raw as { contentType?: string }).contentType ||
            String(req.headers['content-type'] || 'image/jpeg').split(';')[0] ||
            'image/jpeg'
        }
      }

      if (!body || body.length < MIN_AVATAR_BYTES) {
        const fetched = await fetchXAvatar(handle)
        if (!fetched) {
          return res.status(502).json({
            error: 'fetch_failed',
            message: 'Could not download avatar from X',
          })
        }
        body = fetched.body
        contentType = fetched.contentType.includes('png')
          ? 'image/png'
          : fetched.contentType.includes('webp')
            ? 'image/webp'
            : 'image/jpeg'
      }

      // Always store as .jpg key; content-type from source
      await r2PutBytes(client, key, body, contentType)
      const publicBase = r2PublicBase()
      return res.status(200).json({
        ok: true,
        handle,
        key,
        bytes: body.length,
        contentType,
        url: publicBase ? `${publicBase}/${key}` : `/api/avatar?handle=${handle}`,
      })
    } catch (e) {
      console.error('[api/avatar PUT]', e)
      return res.status(500).json({
        error: 'server_error',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
