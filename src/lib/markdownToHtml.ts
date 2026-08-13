/**
 * Markdown → safe HTML for contentEditable preview editing.
 * Mirrors ReportMarkdown block rules; escapes text (no raw HTML passthrough).
 * Each block is annotated with data-md-start / data-md-end (offsets into `raw`).
 */

import { isGenericImageAlt } from './imageAlt'
import { isSafeImageUrl as isSafeUrl } from './safeUrl'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineToHtml(text: string): string {
  if (!text) return ''
  const parts: string[] = []
  const re =
    /(!\[([^\]]*)\]\((?:<)?([^)\s>]+)(?:>)?(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g
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
          `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="report-md__inline-img" loading="eager" decoding="async" contenteditable="false" />`,
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

type Line = { text: string; start: number; end: number }

/** Split preserving original offsets (supports \\n, \\r\\n, \\r). */
function splitLines(raw: string): Line[] {
  const s = raw || ''
  const result: Line[] = []
  let i = 0
  let start = 0
  while (i <= s.length) {
    const atEnd = i === s.length
    const isCRLF = !atEnd && s[i] === '\r' && s[i + 1] === '\n'
    const isLF = !atEnd && s[i] === '\n'
    const isCR = !atEnd && s[i] === '\r' && !isCRLF
    if (atEnd || isLF || isCRLF || isCR) {
      result.push({ text: s.slice(start, i), start, end: i })
      if (atEnd) break
      i += isCRLF ? 2 : 1
      start = i
      continue
    }
    i++
  }
  if (s.length === 0) result.push({ text: '', start: 0, end: 0 })
  return result
}

function mdAttr(start: number, end: number): string {
  return ` data-md-start="${start}" data-md-end="${end}"`
}

function spanRange(lines: Line[], from: number, toExclusive: number): {
  start: number
  end: number
} {
  if (toExclusive <= from || from >= lines.length) {
    const s = lines[Math.min(from, lines.length - 1)]?.start ?? 0
    return { start: s, end: s }
  }
  return {
    start: lines[from].start,
    end: lines[toExclusive - 1].end,
  }
}

/** Convert markdown-ish report text to HTML for contentEditable. */
export function markdownToHtml(raw: string): string {
  const lines = splitLines(raw || '')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].text
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      const blockStart = i
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].text.trim().startsWith('```')) {
        codeLines.push(lines[i].text)
        i++
      }
      if (i < lines.length) i++
      const { start, end } = spanRange(lines, blockStart, i)
      out.push(
        `<pre class="report-md__code"${mdAttr(start, end)}><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`,
      )
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      const { start, end } = spanRange(lines, i, i + 1)
      out.push(`<hr class="report-md__hr"${mdAttr(start, end)} />`)
      i++
      continue
    }

    const hm = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      const { start, end } = spanRange(lines, i, i + 1)
      out.push(
        `<h${level} class="report-md__h${level}"${mdAttr(start, end)}>${inlineToHtml(hm[2])}</h${level}>`,
      )
      i++
      continue
    }

    const imgOnly = trimmed.match(
      /^!\[([^\]]*)\]\((<)?([^)\s>]+)(?:>)?(?:\s+"[^"]*")?\)$/,
    )
    if (imgOnly) {
      const alt = imgOnly[1]
      const src = (imgOnly[3] || '').trim()
      const { start, end } = spanRange(lines, i, i + 1)
      if (isSafeUrl(src)) {
        // Alt mirrored into figcaption is display-only (data-md-alt-mirror).
        // Generic placeholders like "image" are omitted so WYSIWYG ↔ MD
        // roundtrips don't spawn "*image*" caption lines.
        const caption =
          alt && !isGenericImageAlt(alt)
            ? `<figcaption class="report-md__caption" data-md-alt-mirror="1" contenteditable="false">${escapeHtml(alt)}</figcaption>`
            : ''
        out.push(
          `<figure class="report-md__figure"${mdAttr(start, end)}><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="report-md__img" loading="eager" decoding="async" contenteditable="false" />${caption}</figure>`,
        )
      } else {
        // Never silently drop image lines — show why preview blocked them
        out.push(
          `<figure class="report-md__figure"${mdAttr(start, end)}><div class="report-md__img-blocked" contenteditable="false">Ảnh bị chặn (URL không hợp lệ): ${escapeHtml(src || trimmed.slice(0, 120))}</div></figure>`,
        )
      }
      i++
      continue
    }

    if (trimmed.startsWith('>')) {
      const blockStart = i
      const qItems: { html: string; start: number; end: number }[] = []
      while (i < lines.length && lines[i].text.trim().startsWith('>')) {
        const body = lines[i].text.trim().replace(/^>\s?/, '')
        qItems.push({
          html: inlineToHtml(body),
          start: lines[i].start,
          end: lines[i].end,
        })
        i++
      }
      const { start, end } = spanRange(lines, blockStart, i)
      out.push(
        `<blockquote class="report-md__quote"${mdAttr(start, end)}>${qItems
          .map(
            (q) =>
              `<p${mdAttr(q.start, q.end)}>${q.html}</p>`,
          )
          .join('')}</blockquote>`,
      )
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const blockStart = i
      const items: { html: string; start: number; end: number }[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].text.trim())) {
        items.push({
          html: inlineToHtml(lines[i].text.trim().replace(/^[-*+]\s+/, '')),
          start: lines[i].start,
          end: lines[i].end,
        })
        i++
      }
      const { start, end } = spanRange(lines, blockStart, i)
      out.push(
        `<ul class="report-md__ul"${mdAttr(start, end)}>${items
          .map(
            (item) =>
              `<li${mdAttr(item.start, item.end)}>${item.html}</li>`,
          )
          .join('')}</ul>`,
      )
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const blockStart = i
      const items: { html: string; start: number; end: number }[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].text.trim())) {
        items.push({
          html: inlineToHtml(
            lines[i].text.trim().replace(/^\d+[.)]\s+/, ''),
          ),
          start: lines[i].start,
          end: lines[i].end,
        })
        i++
      }
      const { start, end } = spanRange(lines, blockStart, i)
      out.push(
        `<ol class="report-md__ol"${mdAttr(start, end)}>${items
          .map(
            (item) =>
              `<li${mdAttr(item.start, item.end)}>${item.html}</li>`,
          )
          .join('')}</ol>`,
      )
      continue
    }

    if (isTableRow(line)) {
      const blockStart = i
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i].text)) {
        tableLines.push(lines[i].text)
        i++
      }
      const { start, end } = spanRange(lines, blockStart, i)
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
        `<div class="report-md__table-wrap"${mdAttr(start, end)}><table class="report-md__table">${thead}${tbody}</table></div>`,
      )
      continue
    }

    if (!trimmed) {
      const { start, end } = spanRange(lines, i, i + 1)
      out.push(
        `<div class="report-md__spacer" aria-hidden="true"${mdAttr(start, end)}></div>`,
      )
      i++
      continue
    }

    {
      const { start, end } = spanRange(lines, i, i + 1)
      out.push(
        `<p class="report-md__p"${mdAttr(start, end)}>${inlineToHtml(line)}</p>`,
      )
      i++
    }
  }

  return out.join('') || '<p class="report-md__p" data-md-start="0" data-md-end="0"><br></p>'
}
