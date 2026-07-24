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

/**
 * Import a .docx File: extract HTML via mammoth, upload each image to R2,
 * convert HTML → Markdown for the report editor / AI corpus.
 */
export async function docxFileToReportMarkdown(
  file: File,
  options?: {
    token?: string
    handle?: string
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
          progress(`Upload ảnh ${imgIndex} → R2…`)
          try {
            const contentType =
              (image as { contentType?: string }).contentType || 'image/png'
            // Prefer array buffer for binary fidelity
            const readAsArrayBuffer = (
              image as {
                readAsArrayBuffer?: () => Promise<ArrayBuffer>
                read?: (enc: string) => Promise<string>
              }
            ).readAsArrayBuffer
            let bytes: ArrayBuffer
            if (typeof readAsArrayBuffer === 'function') {
              bytes = await readAsArrayBuffer.call(image)
            } else {
              const b64 = await (
                image as { read: (enc: string) => Promise<string> }
              ).read('base64')
              const bin = atob(b64)
              const u8 = new Uint8Array(bin.length)
              for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
              bytes = u8.buffer
            }

            // Skip tiny decorative artifacts
            if (bytes.byteLength < 80) {
              imagesFailed++
              return { src: '' }
            }

            const up = await uploadKolReportImageBytes(bytes, {
              token: options?.token,
              handle: options?.handle || 'docx',
              contentType,
              stem: `docx_${options?.handle || 'report'}_${imgIndex}`,
            })
            if (!up.ok) {
              imagesFailed++
              console.warn('[docx→r2]', up.error)
              return { src: '' }
            }
            imagesUploaded++
            imageUrls.push(up.url)
            imageKeys.push(up.key)
            return { src: up.url }
          } catch (err) {
            imagesFailed++
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
    // Strip empty img tags (failed uploads)
    const cleanedHtml = html
      .replace(/<img[^>]+src=["']\s*["'][^>]*>/gi, '')
      .replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, '')

    let markdown = htmlToMarkdown(cleanedHtml)
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

    // Append image gallery section if images exist but markdown lost some
    const mdImgCount = (markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
    if (imageUrls.length > mdImgCount) {
      const missing = imageUrls.slice(mdImgCount)
      markdown +=
        '\n\n## Hình ảnh đính kèm\n\n' +
        missing.map((u, i) => `![Hình ${mdImgCount + i + 1}](${u})`).join('\n\n') +
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
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
