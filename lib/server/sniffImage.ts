import type { VercelRequest } from '@vercel/node'

export class BodyTooLargeError extends Error {
  override name = 'BodyTooLargeError'
  constructor(public readonly maxBytes: number) {
    super(`Max ${maxBytes} bytes`)
  }
}

const ALLOWED_HINT = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

/** Magic-byte sniff; hinted Content-Type is only used when magic is ambiguous. */
export function sniffImageContentType(
  body: Buffer,
  hinted = '',
): string | null {
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
      body.length >= 12 &&
      body[8] === 0x57 &&
      body[9] === 0x45 &&
      body[10] === 0x42 &&
      body[11] === 0x50
    )
      return 'image/webp'
  }
  const h = (hinted || '').toLowerCase().split(';')[0].trim()
  if (ALLOWED_HINT.has(h)) return h === 'image/jpg' ? 'image/jpeg' : h
  return null
}

/**
 * Buffer a raw request body, aborting as soon as `maxBytes` is exceeded.
 */
export async function readRawBodyLimited(
  req: VercelRequest,
  maxBytes: number,
): Promise<Buffer> {
  const raw = req.body
  if (raw && (Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
    const buf = Buffer.from(raw)
    if (buf.length > maxBytes) throw new BodyTooLargeError(maxBytes)
    return buf
  }
  if (typeof raw === 'string' && raw.length > 0) {
    if (raw.startsWith('data:') && raw.includes('base64,')) {
      const b64 = raw.split('base64,')[1] || ''
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > maxBytes) throw new BodyTooLargeError(maxBytes)
      return buf
    }
    const buf = Buffer.from(raw, 'latin1')
    if (buf.length > maxBytes) throw new BodyTooLargeError(maxBytes)
    return buf
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += b.length
    if (size > maxBytes) {
      try {
        req.destroy()
      } catch {
        /* ignore */
      }
      throw new BodyTooLargeError(maxBytes)
    }
    chunks.push(b)
  }
  return Buffer.concat(chunks)
}
