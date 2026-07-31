/**
 * Local DOCX → image probe (no R2 upload).
 * Usage: node scripts/test-docx-images.mjs "C:\path\to\file.docx"
 */
import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'

const docxPath = process.argv[2]
if (!docxPath || !fs.existsSync(docxPath)) {
  console.error('DOCX not found:', docxPath)
  process.exit(1)
}

const buf = fs.readFileSync(docxPath)
let imgIndex = 0
const images = []

const result = await mammoth.convertToHtml(
  { buffer: buf },
  {
    convertImage: mammoth.images.imgElement(async (image) => {
      imgIndex += 1
      const contentType = image.contentType || 'unknown'
      let size = 0
      try {
        if (typeof image.readAsArrayBuffer === 'function') {
          const ab = await image.readAsArrayBuffer()
          size = ab.byteLength
        } else if (typeof image.readAsBase64String === 'function') {
          const b64 = await image.readAsBase64String()
          size = Buffer.from(b64, 'base64').length
        } else {
          const b64 = await image.read('base64')
          size = Buffer.from(b64, 'base64').length
        }
      } catch (e) {
        images.push({
          index: imgIndex,
          contentType,
          error: e instanceof Error ? e.message : String(e),
        })
        return { src: '' }
      }
      const placeholder = `https://example.com/docx_${imgIndex}.png`
      images.push({
        index: imgIndex,
        contentType,
        bytes: size,
        alt: image.altText || '',
        okType: /image\/(png|jpeg|jpg|gif|webp)/i.test(contentType),
      })
      return { src: placeholder, alt: image.altText || 'image' }
    }),
  },
)

const html = String(result.value || '')
const htmlImgs = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map(
  (m) => m[1],
)
const emptySrc = (html.match(/<img\b[^>]*src=["']\s*["']/gi) || []).length

console.log(
  JSON.stringify(
    {
      file: path.basename(docxPath),
      bytes: buf.length,
      mammothImagesFound: images.length,
      htmlImgWithSrc: htmlImgs.length,
      htmlImgEmptySrc: emptySrc,
      previewWouldShowImages: htmlImgs.length,
      uploadableToR2: images.filter((i) => i.okType && (i.bytes || 0) >= 80)
        .length,
      unsupportedTypes: images.filter((i) => !i.okType).map((i) => i.contentType),
      imageDetails: images,
      warnings: (result.messages || [])
        .slice(0, 20)
        .map((m) => m.message || String(m)),
      firstImgHtml: htmlImgs[0] || null,
    },
    null,
    2,
  ),
)
