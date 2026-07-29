/**
 * Browser HTML → Markdown for smart paste (Word / Docs / Notion / browser / ChatGPT)
 * and WYSIWYG contentEditable sync. Zero dependency — DOMParser only.
 */

import { isGenericImageAlt } from './imageAlt'

function cleanText(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeMd(s: string): string {
  return s.replace(/([\\`*_[\]#])/g, '\\$1')
}

function imgAlt(el: HTMLElement): string {
  // Preserve empty alt=""; only default when attribute is missing (paste).
  const raw = el.getAttribute('alt')
  if (raw == null) return 'image'
  return raw
}

function mdImage(src: string, alt: string, block = false): string {
  if (!src || src.startsWith('data:')) return ''
  const body = `![${alt}](${src})`
  return block ? `\n${body}\n\n` : body
}

function isAltMirrorCaption(cap: HTMLElement, alt: string): boolean {
  if (cap.getAttribute('data-md-alt-mirror') === '1') return true
  const text = cleanText(childrenInline(cap))
  if (!text) return true
  if (text === cleanText(alt)) return true
  if (isGenericImageAlt(text) && isGenericImageAlt(alt)) return true
  return false
}

function inlineFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\s+/g, ' ')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  // Skip noise
  if (
    tag === 'style' ||
    tag === 'script' ||
    tag === 'meta' ||
    tag === 'link' ||
    tag === 'xml' ||
    tag === 'o:p'
  ) {
    return ''
  }

  if (tag === 'br') return '\n'
  if (tag === 'img') {
    return mdImage(
      (el.getAttribute('src') || '').trim(),
      imgAlt(el),
      false,
    )
  }
  if (tag === 'a') {
    const href = el.getAttribute('href') || ''
    const label = cleanText(childrenInline(el))
    if (!href || href.startsWith('javascript:')) return label
    return `[${label || href}](${href})`
  }
  if (tag === 'strong' || tag === 'b') {
    const inner = cleanText(childrenInline(el))
    return inner ? `**${inner}**` : ''
  }
  if (tag === 'em' || tag === 'i') {
    const inner = cleanText(childrenInline(el))
    return inner ? `*${inner}*` : ''
  }
  if (tag === 'code') {
    const inner = el.textContent || ''
    return `\`${inner.replace(/`/g, "'")}\``
  }
  if (tag === 'span' || tag === 'font') {
    // Word often wraps bold in span+style
    const style = (el.getAttribute('style') || '').toLowerCase()
    const fw =
      style.includes('font-weight:bold') || style.includes('font-weight: 700')
    const it = style.includes('font-style:italic')
    let inner = childrenInline(el)
    if (fw) inner = `**${cleanText(inner)}**`
    else if (it) inner = `*${cleanText(inner)}*`
    return inner
  }
  // Don't serialize display-only image captions as inline italics
  if (tag === 'figcaption') {
    return ''
  }
  return childrenInline(el)
}

function childrenInline(el: HTMLElement): string {
  let out = ''
  for (const child of Array.from(el.childNodes)) {
    out += inlineFromNode(child)
  }
  return out
}

function cellText(td: HTMLElement): string {
  return cleanText(childrenInline(td)).replace(/\|/g, '\\|')
}

function blockFromElement(el: HTMLElement, listDepth = 0): string {
  const tag = el.tagName.toLowerCase()

  if (
    tag === 'style' ||
    tag === 'script' ||
    tag === 'meta' ||
    tag === 'link' ||
    tag === 'head' ||
    tag === 'figcaption'
  ) {
    return ''
  }

  if (tag === 'h1') return `\n# ${cleanText(childrenInline(el))}\n\n`
  if (tag === 'h2') return `\n## ${cleanText(childrenInline(el))}\n\n`
  if (tag === 'h3') return `\n### ${cleanText(childrenInline(el))}\n\n`
  if (tag === 'h4') return `\n#### ${cleanText(childrenInline(el))}\n\n`

  if (tag === 'figure') {
    const img = el.querySelector('img')
    if (img) {
      const imgEl = img as HTMLElement
      const src = (imgEl.getAttribute('src') || '').trim()
      const alt = imgAlt(imgEl)
      let out = mdImage(src, alt, true)
      const cap = el.querySelector('figcaption')
      if (cap && !isAltMirrorCaption(cap as HTMLElement, alt)) {
        const c = cleanText(childrenInline(cap as HTMLElement))
        // Real extra caption (rare) — keep as italic line under image
        if (c) out += `*${c}*\n\n`
      }
      return out
    }
    return ''
  }

  if (tag === 'p' || tag === 'div') {
    // Spacer used by markdown renderer
    if (el.classList.contains('report-md__spacer')) return '\n'
    // Table wrap
    if (el.classList.contains('report-md__table-wrap')) {
      const table = el.querySelector('table')
      return table ? blockFromElement(table as HTMLElement, listDepth) : ''
    }
    // Figure wrap (some browsers nest oddly)
    if (el.classList.contains('report-md__figure')) {
      return blockFromElement(
        (el.querySelector('img') as HTMLElement) || el,
        listDepth,
      )
    }
    // Mammoth often wraps a lone image in <p>
    const elementChildren = Array.from(el.children)
    if (
      elementChildren.length === 1 &&
      elementChildren[0].tagName.toLowerCase() === 'img' &&
      cleanText(el.textContent || '') === ''
    ) {
      return blockFromElement(elementChildren[0] as HTMLElement, listDepth)
    }
    // Lone figure inside p/div
    if (
      elementChildren.length === 1 &&
      elementChildren[0].tagName.toLowerCase() === 'figure'
    ) {
      return blockFromElement(elementChildren[0] as HTMLElement, listDepth)
    }
    // Paragraphs with mixed text + images
    if (elementChildren.some((c) => c.tagName.toLowerCase() === 'img')) {
      let out = ''
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const ctag = (child as HTMLElement).tagName.toLowerCase()
          if (ctag === 'img') {
            out += blockFromElement(child as HTMLElement, listDepth)
          } else {
            const piece = inlineFromNode(child)
            if (cleanText(piece)) out += `${cleanText(piece)}\n\n`
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const t = cleanText(child.textContent || '')
          if (t) out += `${t}\n\n`
        }
      }
      return out
    }
    // Nested blocks inside div
    const hasBlock = Array.from(el.children).some((c) =>
      /^(UL|OL|TABLE|H1|H2|H3|H4|PRE|BLOCKQUOTE|P|DIV|IMG|FIGURE|HR)$/i.test(
        c.tagName,
      ),
    )
    if (hasBlock) {
      let out = ''
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          out += blockFromElement(child as HTMLElement, listDepth)
        } else if (child.nodeType === Node.TEXT_NODE) {
          const t = cleanText(child.textContent || '')
          if (t) out += `${t}\n\n`
        }
      }
      return out
    }
    const t = cleanText(childrenInline(el))
    return t ? `${t}\n\n` : ''
  }

  if (tag === 'br') return '\n'

  if (tag === 'hr') return '\n---\n\n'

  if (tag === 'blockquote') {
    // Prefer block children (p) so multi-line quotes survive roundtrip
    const blockKids = Array.from(el.children).filter((c) =>
      /^(P|DIV)$/i.test(c.tagName),
    )
    if (blockKids.length) {
      const lines = blockKids
        .map((c) => cleanText(childrenInline(c as HTMLElement)))
        .filter(Boolean)
        .map((l) => `> ${l}`)
      return lines.length ? `\n${lines.join('\n')}\n\n` : ''
    }
    const inner = cleanText(childrenInline(el))
      .split(/\n+/)
      .filter(Boolean)
      .map((l) => `> ${l}`)
      .join('\n')
    return inner ? `\n${inner}\n\n` : ''
  }

  if (tag === 'pre') {
    const code = (el.textContent || '').replace(/\n$/, '')
    return `\n\`\`\`\n${code}\n\`\`\`\n\n`
  }

  if (tag === 'ul' || tag === 'ol') {
    let out = '\n'
    let i = 1
    for (const li of Array.from(el.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue
      const liEl = li as HTMLElement
      // nested lists
      let nested = ''
      const parts: string[] = []
      for (const child of Array.from(liEl.childNodes)) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          /^(UL|OL)$/i.test((child as HTMLElement).tagName)
        ) {
          nested += blockFromElement(child as HTMLElement, listDepth + 1)
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          parts.push(inlineFromNode(child))
        } else if (child.nodeType === Node.TEXT_NODE) {
          parts.push(child.textContent || '')
        }
      }
      const text = cleanText(parts.join(''))
      const pad = '  '.repeat(listDepth)
      if (tag === 'ol') {
        out += `${pad}${i}. ${text}\n`
        i++
      } else {
        out += `${pad}- ${text}\n`
      }
      out += nested
    }
    return `${out}\n`
  }

  if (tag === 'table') {
    const rows: string[][] = []
    for (const tr of Array.from(el.querySelectorAll('tr'))) {
      const cells = Array.from(tr.querySelectorAll('th,td')).map((c) =>
        cellText(c as HTMLElement),
      )
      if (cells.length) rows.push(cells)
    }
    if (!rows.length) return ''
    const cols = Math.max(...rows.map((r) => r.length))
    const pad = (r: string[]) => {
      const x = [...r]
      while (x.length < cols) x.push('')
      return x
    }
    const header = pad(rows[0])
    const body = rows.slice(1).map(pad)
    let md = '\n| ' + header.join(' | ') + ' |\n'
    md += '| ' + header.map(() => '---').join(' | ') + ' |\n'
    for (const r of body) {
      md += '| ' + r.join(' | ') + ' |\n'
    }
    return md + '\n'
  }

  if (tag === 'img') {
    return mdImage((el.getAttribute('src') || '').trim(), imgAlt(el), true)
  }

  // body/html/section/article — recurse
  if (
    tag === 'body' ||
    tag === 'html' ||
    tag === 'section' ||
    tag === 'article' ||
    tag === 'main' ||
    tag === 'td' ||
    tag === 'th' ||
    tag === 'li'
  ) {
    let out = ''
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        out += blockFromElement(child as HTMLElement, listDepth)
      } else if (child.nodeType === Node.TEXT_NODE) {
        const t = cleanText(child.textContent || '')
        if (t) out += `${t}\n\n`
      }
    }
    return out
  }

  // fallback
  const t = cleanText(childrenInline(el))
  return t ? `${t}\n\n` : ''
}

/**
 * Remove italic lines that merely repeat the preceding image's alt
 * (legacy WYSIWYG bug: figcaption(alt) → *alt* on every save).
 */
export function scrubMirroredImageCaptions(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    out.push(line)
    const m = line
      .trim()
      .match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/)
    i++
    if (!m) continue
    const alt = m[1]
    if (!alt) continue
    // Drop following blank + *alt* / _alt_ mirrors (possibly repeated)
    while (i < lines.length) {
      let k = i
      while (k < lines.length && lines[k].trim() === '') k++
      if (k >= lines.length) break
      const t = lines[k].trim()
      const isMirror =
        t === `*${alt}*` ||
        t === `_${alt}_` ||
        (isGenericImageAlt(alt) &&
          (t === '*image*' ||
            t === '_image_' ||
            t === '*img*' ||
            t === '_img_'))
      if (!isMirror) break
      i = k + 1
    }
  }
  return out.join('\n')
}

/** Normalize markdown whitespace after conversion */
export function normalizeMarkdown(md: string): string {
  let out = scrubMirroredImageCaptions(md)
  out = out
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    // blank line before/after images
    .replace(/([^\n])\n(!\[)/g, '$1\n\n$2')
    .replace(/(!\[[^\]]*\]\([^)]+\))\n([^\n])/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  // Second scrub after blank-line polish (mirrors may have been separated)
  out = scrubMirroredImageCaptions(out)
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Convert clipboard / contentEditable HTML to markdown.
 * Returns null if HTML is empty / not useful.
 */
export function htmlToMarkdown(
  html: string,
  opts?: { loose?: boolean },
): string | null {
  if (!html || !html.trim()) return null
  // Ignore tiny wrappers that are effectively plain text
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(meta|link|style|script|xml)[^>]*>/gi, '')
    .trim()
  if (!stripped) return null

  try {
    const doc = new DOMParser().parseFromString(stripped, 'text/html')
    const body = doc.body
    if (!body) return null
    const md = normalizeMarkdown(blockFromElement(body))
    if (!md || md.length < 1) return null
    // If conversion produced almost nothing useful vs plain length, skip
    if (!opts?.loose && md.replace(/\W/g, '').length < 2) return null
    return md
  } catch {
    return null
  }
}

/**
 * Decide whether HTML paste is "rich" enough to convert
 * (vs simple browser selection that is already fine as text).
 */
export function shouldConvertHtmlPaste(html: string, plain: string): boolean {
  if (!html || !html.trim()) return false
  const h = html.toLowerCase()
  // Real rich sources
  if (
    h.includes('<h1') ||
    h.includes('<h2') ||
    h.includes('<h3') ||
    h.includes('<table') ||
    h.includes('<ul') ||
    h.includes('<ol') ||
    h.includes('<li') ||
    h.includes('<strong') ||
    h.includes('<b>') ||
    h.includes('<em') ||
    h.includes('<blockquote') ||
    h.includes('mso-') || // Word
    h.includes('docs-internal') || // Google Docs
    h.includes('<img')
  ) {
    return true
  }
  // Prefer plain if HTML is just a single span/p wrapping same text
  const plainClean = (plain || '').replace(/\s+/g, ' ').trim()
  const htmlText = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plainClean && htmlText === plainClean && !h.includes('<br')) {
    return false
  }
  return h.includes('<p') || h.includes('<br') || h.includes('<div')
}

// silence unused in some trees
void escapeMd
