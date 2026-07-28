/**
 * Markdown → safe HTML for contentEditable preview editing.
 * Mirrors ReportMarkdown block rules; escapes text (no raw HTML passthrough).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSafeUrl(url: string): boolean {
  const u = (url || '').trim()
  if (!u) return false
  if (u.startsWith('/')) return true
  if (u.startsWith('data:image/')) return true
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function inlineToHtml(text: string): string {
  if (!text) return ''
  const parts: string[] = []
  const re =
    /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(escapeHtml(text.slice(last, m.index)))
    }
    if (m[0].startsWith('![')) {
      const alt = m[2] || ''
      const src = m[3] || ''
      if (isSafeUrl(src)) {
        parts.push(
          `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="report-md__inline-img" />`,
        )
      } else {
        parts.push(escapeHtml(m[0]))
      }
    } else if (m[0].startsWith('[')) {
      const label = m[4] || ''
      const href = m[5] || ''
      if (isSafeUrl(href)) {
        parts.push(
          `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="report-md__a">${escapeHtml(label)}</a>`,
        )
      } else {
        parts.push(escapeHtml(label))
      }
    } else if (m[0].startsWith('**')) {
      parts.push(`<strong>${escapeHtml(m[6])}</strong>`)
    } else if (m[0].startsWith('*')) {
      parts.push(`<em>${escapeHtml(m[7])}</em>`)
    } else if (m[0].startsWith('`')) {
      parts.push(
        `<code class="report-md__inline-code">${escapeHtml(m[8])}</code>`,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(escapeHtml(text.slice(last)))
  return parts.join('')
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  if (!t.includes('|')) return false
  return /^\|?.+\|.+\|?$/.test(t) && t.replace(/\|/g, '').trim().length > 0
}

function isSeparatorRow(line: string): boolean {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells = t.split('|').map((c) => c.trim())
  if (!cells.length) return false
  return cells.every((c) => /^:?-{3,}:?$/.test(c) || c === '')
}

function splitCells(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((c) => c.trim())
}

/** Convert markdown-ish report text to HTML for contentEditable. */
export function markdownToHtml(raw: string): string {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      out.push(
        `<pre class="report-md__code"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
      )
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr class="report-md__hr" />')
      i++
      continue
    }

    const hm = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      out.push(
        `<h${level} class="report-md__h${level}">${inlineToHtml(hm[2])}</h${level}>`,
      )
      i++
      continue
    }

    const imgOnly = trimmed.match(
      /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/,
    )
    if (imgOnly) {
      const alt = imgOnly[1]
      const src = imgOnly[2]
      if (isSafeUrl(src)) {
        out.push(
          `<figure class="report-md__figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="report-md__img" loading="lazy" />${
            alt
              ? `<figcaption class="report-md__caption">${escapeHtml(alt)}</figcaption>`
              : ''
          }</figure>`,
        )
      }
      i++
      continue
    }

    if (trimmed.startsWith('>')) {
      const qLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      out.push(
        `<blockquote class="report-md__quote">${qLines
          .map((l) => `<p>${inlineToHtml(l)}</p>`)
          .join('')}</blockquote>`,
      )
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''))
        i++
      }
      out.push(
        `<ul class="report-md__ul">${items
          .map((item) => `<li>${inlineToHtml(item)}</li>`)
          .join('')}</ul>`,
      )
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      out.push(
        `<ol class="report-md__ol">${items
          .map((item) => `<li>${inlineToHtml(item)}</li>`)
          .join('')}</ol>`,
      )
      continue
    }

    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const rowsRaw = tableLines.map(splitCells)
      const colCount = Math.max(...rowsRaw.map((r) => r.length), 0)
      const pad = (r: string[]) => {
        const next = [...r]
        while (next.length < colCount) next.push('')
        return next.slice(0, colCount)
      }
      let header: string[] | null = null
      let bodyStart = 0
      if (tableLines.length >= 2 && isSeparatorRow(tableLines[1])) {
        header = pad(rowsRaw[0])
        bodyStart = 2
      }
      const bodyRows: string[][] = []
      for (let j = bodyStart; j < rowsRaw.length; j++) {
        if (isSeparatorRow(tableLines[j])) continue
        bodyRows.push(pad(rowsRaw[j]))
      }
      const thead = header
        ? `<thead><tr>${header
            .map((c) => `<th>${inlineToHtml(c)}</th>`)
            .join('')}</tr></thead>`
        : ''
      const tbody = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${inlineToHtml(c)}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>`
      out.push(
        `<div class="report-md__table-wrap"><table class="report-md__table">${thead}${tbody}</table></div>`,
      )
      continue
    }

    if (!trimmed) {
      out.push('<div class="report-md__spacer" aria-hidden="true"></div>')
      i++
      continue
    }

    out.push(`<p class="report-md__p">${inlineToHtml(line)}</p>`)
    i++
  }

  return out.join('') || '<p class="report-md__p"><br></p>'
}
