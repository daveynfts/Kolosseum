/**
 * Convert DOCX → Markdown for KOL reports.
 * Embedded images are uploaded to Cloudflare R2 (kol-reports/images/)
 * so markdown only stores public CDN URLs (no base64 bloat).
 *
 * mammoth is dynamic-imported so the admin bundle only loads it on DOCX use.
 */
import {
  htmlToMarkdown,
  normalizeMarkdown,
} from './htmlToMarkdown'
import { uploadKolReportImageBytes } from './kolReportImageUpload'

export type DocxImportResult =
  | {
      ok: true
      markdown: string
      html: string
      imagesUploaded: number
      imagesFailed: number
      imageUrls: string[]
      imageKeys: string[]
      warnings: string[]
      sourceFilename: string
      chars: number
      imageErrors: string[]
    }
  | { ok: false; error: string }

const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "r[style-name='Strong'] => strong",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Block Text'] => blockquote > p:fresh",
]

const R2_OK_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

type MammothImage = {
  contentType?: string
  altText?: string
  readAsArrayBuffer?: () => Promise<ArrayBuffer>
  readAsBase64String?: () => Promise<string>
  readAsBuffer?: () => Promise<ArrayBuffer | Uint8Array | { buffer: ArrayBuffer }>
  read?: (enc?: string) => Promise<string | ArrayBuffer | Uint8Array>
}

/** Post-process markdown for nicer report layout */
function polishReportMarkdown(md: string, sourceName: string): string {
  let out = normalizeMarkdown(md)
  // Ensure blank line before images
  out = out.replace(/([^\n])\n(!\[)/g, '$1\n\n$2')
  // Ensure blank line after images
  out = out.replace(/(!\[[^\]]*\]\([^)]+\))\n([^\n])/g, '$1\n\n$2')
  // Collapse excessive blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim()

  // If doc has no H1, prepend from filename
  if (!/^#\s+/m.test(out) && sourceName) {
    const title = sourceName
      .replace(/\.docx$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()
    if (title) out = `# ${title}\n\n${out}`
  }
  return out
}

async function readMammothImageBytes(image: MammothImage): Promise<ArrayBuffer> {
  if (typeof image.readAsArrayBuffer === 'function') {
    return image.readAsArrayBuffer.call(image)
  }
  if (typeof image.readAsBuffer === 'function') {
    const buf = await image.readAsBuffer.call(image)
    if (buf instanceof ArrayBuffer) return buf
    if (buf instanceof Uint8Array) {
      const ab = new ArrayBuffer(buf.byteLength)
      new Uint8Array(ab).set(buf)
      return ab
    }
    if (buf && typeof buf === 'object' && 'buffer' in buf) {
      return (buf as { buffer: ArrayBuffer }).buffer
    }
  }
  if (typeof image.readAsBase64String === 'function') {
    const b64 = await image.readAsBase64String.call(image)
    const bin = atob(b64)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8.buffer
  }
  if (typeof image.read === 'function') {
    const raw = await image.read.call(image, 'base64')
    if (typeof raw === 'string') {
      const bin = atob(raw)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      return u8.buffer
    }
    if (raw instanceof ArrayBuffer) return raw
    if (raw instanceof Uint8Array) {
      const ab = new ArrayBuffer(raw.byteLength)
      new Uint8Array(ab).set(raw)
      return ab
    }
  }
  throw new Error('mammoth image: no readable bytes API')
}

/** Re-encode via canvas when Word embeds TIFF/odd types the R2 API rejects. */
async function reencodeToPng(
  bytes: ArrayBuffer,
  contentType: string,
): Promise<ArrayBuffer | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return null
  }
  try {
    const blob = new Blob([bytes], {
      type: contentType || 'application/octet-stream',
    })
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close()
      return null
    }
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    )
    if (!png) return null
    return png.arrayBuffer()
  } catch {
    return null
  }
}

function normalizeDocxContentType(ct: string): string {
  const t = (ct || '').toLowerCase().split(';')[0].trim()
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg'
  return t
}

/**
 * Import a .docx File: extract HTML via mammoth, upload each image to R2,
 * convert HTML → Markdown for the report editor / AI corpus.
 */
export async function docxFileToReportMarkdown(
  file: File,
  options?: {
    token?: string
    handle?: string
    /** Stable R2 overwrite under kol-reports/images/{reportId}/docx_N.ext */
    reportId?: string
    onProgress?: (msg: string) => void
  },
): Promise<DocxImportResult> {
  const name = file.name || 'report.docx'
  if (!/\.docx$/i.test(name) && !name.toLowerCase().includes('wordprocessingml')) {
    // still try if MIME says docx
    const t = (file.type || '').toLowerCase()
    if (
      !t.includes('wordprocessingml') &&
      !t.includes('officedocument') &&
      !t.includes('msword')
    ) {
      return { ok: false, error: 'Chỉ nhận file .docx' }
    }
  }
  if (file.size < 64) {
    return { ok: false, error: 'File DOCX rỗng hoặc quá nhỏ' }
  }
  // Soft client limit — Vercel image uploads are 4.5MB each; docx itself can be larger in browser
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, error: 'DOCX quá lớn (max ~25MB trên trình duyệt)' }
  }

  const progress = options?.onProgress || (() => {})
  progress('Đọc DOCX…')

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Không đọc được file',
    }
  }

  const imageUrls: string[] = []
  const imageKeys: string[] = []
  const imageErrors: string[] = []
  let imagesUploaded = 0
  let imagesFailed = 0
  let imgIndex = 0

  progress('Tải converter DOCX…')
  let mammoth: typeof import('mammoth')
  try {
    mammoth = await import('mammoth')
  } catch (e) {
    return {
      ok: false,
      error:
        'Không load được mammoth: ' +
        (e instanceof Error ? e.message : String(e)),
    }
  }

  progress('Trích xuất nội dung + upload ảnh R2…')

  try {
    // mammoth types are loose; convertImage returns Promise<{src}>
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: STYLE_MAP,
        convertImage: mammoth.images.imgElement(async (image) => {
          imgIndex += 1
          const label = `ảnh ${imgIndex}`
          progress(`Upload ${label} → R2…`)
          try {
            let contentType = normalizeDocxContentType(
              (image as MammothImage).contentType || 'image/png',
            )
            let bytes = await readMammothImageBytes(image as MammothImage)

            // Skip tiny decorative artifacts
            if (bytes.byteLength < 80) {
              imagesFailed++
              imageErrors.push(`${label}: quá nhỏ / decorative`)
              return { src: '' }
            }

            // Re-encode unsupported Word types (tiff/…) when the browser can decode
            if (!R2_OK_TYPES.has(contentType)) {
              const png = await reencodeToPng(bytes, contentType)
              if (png) {
                bytes = png
                contentType = 'image/png'
              } else {
                imagesFailed++
                imageErrors.push(
                  `${label}: định dạng ${contentType || '?'} không hỗ trợ (cần PNG/JPEG/WebP/GIF)`,
                )
                return { src: '' }
              }
            }

            const uploadOnce = async (overwrite: boolean) =>
              uploadKolReportImageBytes(bytes, {
                token: options?.token,
                handle: options?.handle || 'docx',
                contentType,
                stem: `docx_${options?.handle || 'report'}_${imgIndex}`,
                overwrite,
                reportId: options?.reportId,
                slot: `docx_${imgIndex}`,
              })

            // Prefer stable overwrite path; fall back to unique key if that fails
            let up = options?.reportId
              ? await uploadOnce(true)
              : await uploadOnce(false)
            if (!up.ok && options?.reportId) {
              console.warn('[docx→r2] overwrite failed, retry unique', up.error)
              up = await uploadOnce(false)
            }
            if (!up.ok) {
              imagesFailed++
              imageErrors.push(`${label}: ${up.error}`)
              console.warn('[docx→r2]', up.error)
              return { src: '' }
            }
            imagesUploaded++
            imageUrls.push(up.url)
            imageKeys.push(up.key)
            return {
              src: up.url,
              alt: (image as MammothImage).altText || 'image',
            }
          } catch (err) {
            imagesFailed++
            const msg = err instanceof Error ? err.message : String(err)
            imageErrors.push(`${label}: ${msg}`)
            console.warn('[docx image]', err)
            return { src: '' }
          }
        }),
      },
    )

    const html = String(result.value || '')
    const warnings = (result.messages || []).map(
      (m: { message?: string; type?: string }) =>
        String(m.message || m.type || m),
    )

    progress('Chuyển HTML → Markdown…')
    // Strip empty / failed img tags only (keep successful R2 URLs)
    const cleanedHtml = html
      .replace(/<img\b[^>]*\bsrc=["']\s*["'][^>]*>/gi, '')
      .replace(/<img\b[^>]*\bsrc=["']data:[^"']+["'][^>]*>/gi, '')

    let markdown = htmlToMarkdown(cleanedHtml, { loose: true })
    if (!markdown || markdown.trim().length < 8) {
      // Fallback: raw text if HTML path produced little
      const raw = await mammoth.extractRawText({ arrayBuffer })
      markdown = String(raw.value || '').trim()
    }
    if (!markdown || markdown.trim().length < 8) {
      return {
        ok: false,
        error: 'DOCX không trích được nội dung text',
      }
    }

    markdown = polishReportMarkdown(markdown, name)

    // Ensure every uploaded R2 URL appears in markdown (html→md can drop some)
    const present = new Set(
      [...markdown.matchAll(/!\[[^\]]*\]\((<)?([^)\s>]+)(?:>)?/g)].map((m) =>
        (m[2] || '').trim(),
      ),
    )
    const missing = imageUrls.filter((u) => {
      if (present.has(u)) return false
      // also match without cache-buster
      const base = u.split('?')[0]
      for (const p of present) {
        if (p === base || p.split('?')[0] === base) return false
      }
      return true
    })
    if (missing.length) {
      const start = present.size
      markdown +=
        '\n\n## Hình ảnh đính kèm\n\n' +
        missing.map((u, i) => `![Hình ${start + i + 1}](${u})`).join('\n\n') +
        '\n'
    }

    progress('Xong')
    return {
      ok: true,
      markdown,
      html: cleanedHtml,
      imagesUploaded,
      imagesFailed,
      imageUrls,
      imageKeys,
      warnings,
      sourceFilename: name,
      chars: markdown.length,
      imageErrors,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
