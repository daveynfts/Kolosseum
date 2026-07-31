import { Fragment, type ReactNode } from 'react'
import { isGenericImageAlt } from '../lib/imageAlt'

interface Props {
  text: string
  className?: string
  /** Prefer eager load (admin Live Preview) to avoid lazy bugs in nested scrollers */
  eagerImages?: boolean
}

/**
 * Report body renderer: markdown-ish for admin + public reports.
 * Supports headings, bold/italic/code, links, images, lists, tables,
 * blockquotes, hr, fenced code. Escapes raw HTML (no XSS).
 */
export function ReportMarkdown({
  text,
  className = '',
  eagerImages = false,
}: Props) {
  const blocks = parseBlocks(text || '')
  const imgLoading = eagerImages ? 'eager' : 'lazy'
  return (
    <div className={`report-md ${className}`.trim()}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
            return (
              <b.type key={i} className={`report-md__${b.type}`}>
                {renderInline(b.text)}
              </b.type>
            )
          case 'hr':
            return <hr key={i} className="report-md__hr" />
          case 'quote':
            return (
              <blockquote key={i} className="report-md__quote">
                {b.lines.map((line, li) => (
                  <p key={li}>{renderInline(line)}</p>
                ))}
              </blockquote>
            )
          case 'code':
            return (
              <pre key={i} className="report-md__code">
                <code>{b.text}</code>
              </pre>
            )
          case 'ul':
            return (
              <ul key={i} className="report-md__ul">
                {b.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="report-md__ol">
                {b.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item)}</li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={i} className="report-md__table-wrap">
                <table className="report-md__table">
                  {b.header ? (
                    <thead>
                      <tr>
                        {b.header.map((cell, j) => (
                          <th key={j}>{renderInline(cell)}</th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'blank':
            return <div key={i} className="report-md__spacer" aria-hidden />
          case 'image':
            return (
              <figure key={i} className="report-md__figure">
                {isSafeUrl(b.src) ? (
                  <img
                    src={b.src}
                    alt={b.alt || ''}
                    loading={imgLoading}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="report-md__img"
                    onError={(e) => {
                      const el = e.currentTarget
                      el.style.display = 'none'
                      const sib = el.nextElementSibling
                      if (
                        sib &&
                        sib.classList.contains('report-md__img-fallback')
                      ) {
                        ;(sib as HTMLElement).hidden = false
                      }
                    }}
                  />
                ) : null}
                <div
                  className="report-md__img-blocked report-md__img-fallback"
                  hidden={isSafeUrl(b.src)}
                >
                  Không tải được ảnh
                  {b.src ? `: ${b.src.slice(0, 72)}` : ''}
                </div>
                {b.alt && !isGenericImageAlt(b.alt) ? (
                  <figcaption className="report-md__caption">
                    {b.alt}
                  </figcaption>
                ) : null}
              </figure>
            )
          default:
            return (
              <p key={i} className="report-md__p">
                {renderInline(b.text)}
              </p>
            )
        }
      })}
    </div>
  )
}

type Block =
  | { type: 'para'; text: string }
  | { type: 'blank' }
  | { type: 'hr' }
  | { type: 'h1' | 'h2' | 'h3' | 'h4'; text: string }
  | { type: 'quote'; lines: string[] }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; header: string[] | null; rows: string[][] }
  | { type: 'image'; src: string; alt: string }

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Fenced code
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // close fence
      out.push({ type: 'code', text: codeLines.join('\n'), lang })
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push({ type: 'hr' })
      i++
      continue
    }

    // Headings
    const hm = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3 | 4
      out.push({ type: `h${level}` as 'h1' | 'h2' | 'h3' | 'h4', text: hm[2] })
      i++
      continue
    }

    // Standalone image line: ![alt](url)
    const imgOnly = trimmed.match(
      /^!\[([^\]]*)\]\((<)?([^)\s>]+)(?:>)?(?:\s+"[^"]*")?\)$/,
    )
    if (imgOnly) {
      out.push({ type: 'image', alt: imgOnly[1], src: (imgOnly[3] || '').trim() })
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const qLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      out.push({ type: 'quote', lines: qLines })
      continue
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''))
        i++
      }
      out.push({ type: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      out.push({ type: 'ol', items })
      continue
    }

    // Table
    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const table = parseTable(tableLines)
      if (table) out.push(table)
      else {
        for (const tl of tableLines) out.push({ type: 'para', text: tl })
      }
      continue
    }

    if (!trimmed) {
      out.push({ type: 'blank' })
      i++
      continue
    }

    out.push({ type: 'para', text: line })
    i++
  }

  while (out.length && out[0].type === 'blank') out.shift()
  while (out.length && out[out.length - 1].type === 'blank') out.pop()
  return out
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

function parseTable(lines: string[]): Block | null {
  if (lines.length < 2) return null
  const rowsRaw = lines.map(splitCells)
  const colCount = Math.max(...rowsRaw.map((r) => r.length))
  if (colCount < 2) return null
  const pad = (r: string[]) => {
    const next = [...r]
    while (next.length < colCount) next.push('')
    return next.slice(0, colCount)
  }
  let header: string[] | null = null
  let bodyStart = 0
  if (lines.length >= 2 && isSeparatorRow(lines[1])) {
    header = pad(rowsRaw[0])
    bodyStart = 2
  }
  const rows: string[][] = []
  for (let j = bodyStart; j < rowsRaw.length; j++) {
    if (isSeparatorRow(lines[j])) continue
    rows.push(pad(rowsRaw[j]))
  }
  if (!header && rows.length === 0) return null
  return { type: 'table', header, rows }
}

export function isSafeUrl(url: string): boolean {
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

/** Inline: **bold**, *italic*, `code`, [links](url), ![images](url) */
function renderInline(text: string): ReactNode {
  if (!text) return null
  const nodes: ReactNode[] = []
  // Order: image, link, bold, italic, code
  const re =
    /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <Fragment key={key++}>{text.slice(last, m.index)}</Fragment>,
      )
    }
    if (m[0].startsWith('![')) {
      const alt = m[2] || ''
      const src = m[3] || ''
      if (isSafeUrl(src)) {
        nodes.push(
          <img
            key={key++}
            src={src}
            alt={alt}
            className="report-md__inline-img"
            loading="lazy"
          />,
        )
      } else {
        nodes.push(<Fragment key={key++}>{m[0]}</Fragment>)
      }
    } else if (m[0].startsWith('[')) {
      const label = m[4] || ''
      const href = m[5] || ''
      if (isSafeUrl(href)) {
        nodes.push(
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="report-md__a"
          >
            {label}
          </a>,
        )
      } else {
        nodes.push(<Fragment key={key++}>{label}</Fragment>)
      }
    } else if (m[0].startsWith('**')) {
      nodes.push(<strong key={key++}>{m[6]}</strong>)
    } else if (m[0].startsWith('*')) {
      nodes.push(<em key={key++}>{m[7]}</em>)
    } else if (m[0].startsWith('`')) {
      nodes.push(
        <code key={key++} className="report-md__inline-code">
          {m[8]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  }
  return nodes.length === 1 ? nodes[0] : nodes
}
