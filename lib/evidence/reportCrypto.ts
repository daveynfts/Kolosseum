import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const REPORT_DISCLAIMER = 'Báo cáo này chỉ phục vụ nghiên cứu thông tin công khai, không phải lời khuyên đầu tư hoặc khuyến nghị mua/bán tài sản.'

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function parseKey(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error('REPORT_ENC_KEY must be 32 bytes of hex')
  return Buffer.from(keyHex, 'hex')
}

export function encryptReport(content: string, keyHex: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', parseKey(keyHex), iv)
  const ciphertext = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptReport(encrypted: string, keyHex: string): string {
  const [version, ivText, tagText, dataText, extra] = encrypted.split(':')
  if (version !== 'v1' || !ivText || !tagText || !dataText || extra) throw new Error('Invalid encrypted report')
  const decipher = createDecipheriv('aes-256-gcm', parseKey(keyHex), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8')
}

export function hashesMatch(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

const ADVICE_LINE = /(?:\b(?:buy now|sell now|you should buy|you should sell|entry price|take profit|stop loss)\b|(?:^|[\s:])(?:nên|hãy|phải)\s+(?:mua|bán|long|short)\b|(?:điểm\s+(?:mua|bán|vào lệnh)))/i

export function sanitizeResearch(markdown: string): string {
  const withoutImages = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '[Hình ảnh đã lược bỏ]')
  const safeLines = withoutImages.split(/\r?\n/).map((line) =>
    ADVICE_LINE.test(line) ? '[Đã lược bỏ câu mang tính khuyến nghị giao dịch.]' : line,
  )
  const body = safeLines.join('\n').trim()
  if (!body) throw new Error('Research body is empty after sanitization')
  return `${body}\n\n## Disclaimer\n\n${REPORT_DISCLAIMER}\n`
}
