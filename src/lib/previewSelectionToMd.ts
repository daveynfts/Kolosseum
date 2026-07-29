/**
 * Map a Live Preview (contentEditable) selection to markdown source offsets.
 * Relies on `data-md-start` / `data-md-end` from markdownToHtml.
 */

export type MdRange = { start: number; end: number }

function textOffsetInNode(root: Node, target: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let n: Node | null = walker.nextNode()
  while (n) {
    if (n === target) return total + targetOffset
    total += (n.textContent || '').length
    n = walker.nextNode()
  }
  return total
}

function findBestIndex(hay: string, needle: string, prefer: number): number {
  if (!needle) return -1
  const positions: number[] = []
  let from = 0
  while (from <= hay.length) {
    const i = hay.indexOf(needle, from)
    if (i < 0) break
    positions.push(i)
    from = i + Math.max(1, needle.length)
  }
  if (!positions.length) return -1
  if (positions.length === 1) return positions[0]
  const target = prefer * Math.max(0, hay.length - needle.length)
  return positions.reduce((best, p) =>
    Math.abs(p - target) < Math.abs(best - target) ? p : best,
  )
}

function annotatedBounds(
  root: HTMLElement,
  range: Range,
): MdRange | null {
  let mdStart = Infinity
  let mdEnd = -1
  const nodes = root.querySelectorAll('[data-md-start][data-md-end]')
  for (const node of nodes) {
    try {
      if (!range.intersectsNode(node)) continue
    } catch {
      continue
    }
    const s = Number(node.getAttribute('data-md-start'))
    const e = Number(node.getAttribute('data-md-end'))
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) continue
    mdStart = Math.min(mdStart, s)
    mdEnd = Math.max(mdEnd, e)
  }
  if (mdEnd < 0 || !Number.isFinite(mdStart)) return null
  return { start: mdStart, end: mdEnd }
}

/**
 * Convert current DOM selection inside `root` into [start, end) in `md`.
 * Returns null when collapsed / outside / empty.
 */
export function previewSelectionToMdRange(
  root: HTMLElement,
  md: string,
): MdRange | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  const anchorIn = root.contains(sel.anchorNode)
  const focusIn = root.contains(sel.focusNode)
  if (!anchorIn && !focusIn) return null

  const selected = sel.toString().replace(/\u00a0/g, ' ')
  if (!selected.trim()) return null

  const bounds = annotatedBounds(root, range)
  const windowStart = bounds?.start ?? 0
  const windowEnd = bounds?.end ?? md.length
  const hay = md.slice(windowStart, windowEnd)

  const rootText = (root.textContent || '').replace(/\u00a0/g, ' ')
  const selStartInRoot = textOffsetInNode(
    root,
    range.startContainer,
    range.startOffset,
  )
  const prefer =
    rootText.length > 0
      ? Math.min(1, Math.max(0, selStartInRoot / rootText.length))
      : 0
  const preferInHay =
    hay.length > 0 && bounds
      ? Math.min(
          1,
          Math.max(
            0,
            (selStartInRoot /
              Math.max(1, rootText.length)) *
              /* approximate within block */ 1,
          ),
        )
      : prefer

  // Prefer ratio within the annotated window when possible
  let blockPrefer = preferInHay
  if (bounds) {
    const blockEl = Array.from(
      root.querySelectorAll('[data-md-start][data-md-end]'),
    ).find((n) => {
      try {
        return range.intersectsNode(n)
      } catch {
        return false
      }
    }) as HTMLElement | undefined
    if (blockEl) {
      const blockText = (blockEl.textContent || '').replace(/\u00a0/g, ' ')
      try {
        const r = range.cloneRange()
        r.selectNodeContents(blockEl)
        r.setEnd(range.startContainer, range.startOffset)
        const before = r.toString().replace(/\u00a0/g, ' ').length
        blockPrefer =
          blockText.length > 0
            ? Math.min(1, Math.max(0, before / blockText.length))
            : 0
      } catch {
        /* keep prefer */
      }
    }
  }

  let idx = findBestIndex(hay, selected, blockPrefer)
  let len = selected.length

  if (idx < 0) {
    const firstLine = selected.split(/\r?\n/)[0]?.trim() || ''
    if (firstLine.length >= 2) {
      idx = findBestIndex(hay, firstLine, blockPrefer)
      len = firstLine.length
    }
  }

  if (idx < 0) {
    // Soft match: collapse whitespace
    const compact = (s: string) => s.replace(/\s+/g, ' ').trim()
    const needle = compact(selected)
    if (needle.length >= 2) {
      const compactHay = compact(hay)
      const cIdx = findBestIndex(compactHay, needle, blockPrefer)
      if (cIdx >= 0) {
        // Map compact index back roughly → fall back to whole annotated block
        if (bounds) return bounds
      }
    }
  }

  if (idx < 0) {
    return bounds
  }

  return {
    start: windowStart + idx,
    end: windowStart + idx + len,
  }
}
