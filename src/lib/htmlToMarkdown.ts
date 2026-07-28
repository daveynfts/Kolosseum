/**
 * Browser HTML → Markdown for smart paste (Word / Docs / Notion / browser / ChatGPT).
 * Zero dependency — DOMParser only. Output stays AI-friendly plain markdown.
 */

function cleanText(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeMd(s: string): string {
  return s.replace(/([\\`*_[\]#])/g, '\\$1')
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
    const src = (el.getAttribute('src') || '').trim()
    const alt = el.getAttribute('alt') || 'image'
    // Skip empty / base64 (DOCX path uploads to R2 first)
    if (!src || src.startsWith('data:')) return ''
    return `![${alt}](${src})`
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
    const fw = style.includes('font-weight:bold') || style.includes('font-weight: 700')
    const it = style.includes('font-style:italic')
    let inner = childrenInline(el)
    if (fw) inner = `**${cleanText(inner)}**`
    else if (it) inner = `*${cleanText(inner)}*`
    return inner
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
    tag === 'head'
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
      let out = blockFromElement(img as HTMLElement, listDepth)
      const cap = el.querySelector('figcaption')
      if (cap) {
        const c = cleanText(childrenInline(cap as HTMLElement))
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
    // Mammoth often wraps a lone image in <p>
    const elementChildren = Array.from(el.children)
    if (
      elementChildren.length === 1 &&
      elementChildren[0].tagName.toLowerCase() === 'img' &&
      cleanText(el.textContent || '') === ''
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
      /^(UL|OL|TABLE|H1|H2|H3|H4|PRE|BLOCKQUOTE|P|DIV|IMG)$/i.test(c.tagName),
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
    const src = (el.getAttribute('src') || '').trim()
    const alt = el.getAttribute('alt') || 'image'
    if (!src || src.startsWith('data:')) return ''
    return `\n![${alt}](${src})\n\n`
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

/** Normalize markdown whitespace after conversion */
export function normalizeMarkdown(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
