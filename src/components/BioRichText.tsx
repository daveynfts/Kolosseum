import { Fragment, type ReactNode } from 'react'

interface Props {
  text: string
  className?: string
}

/**
 * Lightweight bio renderer: paragraphs, **bold**, and GFM-style tables.
 * Escapes raw HTML — no XSS from admin/R2 content.
 */
export function BioRichText({ text, className = '' }: Props) {
  const blocks = parseBlocks(text || '')
  return (
    <div className={`bio-rich ${className}`.trim()}>
      {blocks.map((b, i) => {
        if (b.type === 'table') {
          return (
            <div key={i} className="bio-rich__table-wrap">
              <table className="bio-rich__table">
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
        }
        if (b.type === 'blank') {
          return <div key={i} className="bio-rich__spacer" aria-hidden />
        }
        return (
          <p key={i} className="bio-rich__p">
            {renderInline(b.text)}
          </p>
        )
      })}
    </div>
  )
}

type Block =
  | { type: 'para'; text: string }
  | { type: 'blank' }
  | { type: 'table'; header: string[] | null; rows: string[][] }

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const table = parseTable(tableLines)
      if (table) out.push(table)
      else {
        for (const tl of tableLines) {
          out.push({ type: 'para', text: tl })
        }
      }
      continue
    }

    if (!line.trim()) {
      out.push({ type: 'blank' })
      i++
      continue
    }

    out.push({ type: 'para', text: line })
    i++
  }

  // Drop leading/trailing blanks
  while (out.length && out[0].type === 'blank') out.shift()
  while (out.length && out[out.length - 1].type === 'blank') out.pop()
  return out
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  if (!t.includes('|')) return false
  // Must look like a markdown table row (pipe-separated cells)
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
  for (let i = bodyStart; i < rowsRaw.length; i++) {
    if (isSeparatorRow(lines[i])) continue
    rows.push(pad(rowsRaw[i]))
  }
  if (!header && rows.length === 0) return null
  return { type: 'table', header, rows }
}

/** Inline: **bold**, *italic* (single asterisks, not list markers at start) */
function renderInline(text: string): ReactNode {
  if (!text) return null
  // Tokenize **bold** and *italic* and keep rest as text
  const nodes: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(
        <Fragment key={key++}>{text.slice(last, m.index)}</Fragment>,
      )
    }
    const tok = m[0]
    if (tok.startsWith('**') && tok.endsWith('**')) {
      nodes.push(
        <strong key={key++}>{tok.slice(2, -2)}</strong>,
      )
    } else if (tok.startsWith('*') && tok.endsWith('*')) {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else {
      nodes.push(<Fragment key={key++}>{tok}</Fragment>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  }
  return nodes.length === 1 ? nodes[0] : nodes
}
