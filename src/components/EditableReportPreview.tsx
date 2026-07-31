/**
 * Live Preview for KOL reports.
 * Images are rendered via React (ReportMarkdown) so they always show.
 * Optional WYSIWYG mode uses contentEditable for text tweaks.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { ReportMarkdown } from './ReportMarkdown'
import { htmlToMarkdown, normalizeMarkdown } from '../lib/htmlToMarkdown'
import { markdownToHtml } from '../lib/markdownToHtml'
import {
  previewSelectionToMdRange,
  type MdRange,
} from '../lib/previewSelectionToMd'

interface Props {
  text: string
  onChange: (markdown: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
  docKey?: string
  /** Prefer React render (images reliable). WYSIWYG is opt-in. */
  wysiwyg?: boolean
  onSelectMdRange?: (
    range: MdRange | null,
    meta?: { final?: boolean },
  ) => void
}

function getPreviewScroller(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  return (el.closest('.akr-preview') as HTMLElement | null) || el.parentElement
}

function ensureCaretVisible(scroller: HTMLElement) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  let rect = range.getBoundingClientRect()
  if (rect.height === 0 && rect.width === 0) {
    const node = range.startContainer
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement
    if (el) rect = el.getBoundingClientRect()
  }
  if (rect.height === 0 && rect.top === 0 && rect.bottom === 0) return
  const box = scroller.getBoundingClientRect()
  const pad = 28
  if (rect.top < box.top + pad) {
    scroller.scrollTop -= box.top + pad - rect.top
  } else if (rect.bottom > box.bottom - pad) {
    scroller.scrollTop += rect.bottom - (box.bottom - pad)
  }
}

function WysiwygBody({
  text,
  onChange,
  className,
  disabled,
  placeholder,
  docKey,
  onSelectMdRange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastMdRef = useRef(text)
  const debounceRef = useRef<number | null>(null)
  const seededKeyRef = useRef('')
  const pinnedScrollRef = useRef<number | null>(null)
  const userEditedRef = useRef(false)
  const seedingRef = useRef(false)
  const onSelectRef = useRef(onSelectMdRange)
  onSelectRef.current = onSelectMdRange
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const seedHtml = (md: string) => {
    const el = ref.current
    if (!el) return
    const scroller = getPreviewScroller(el)
    const top = scroller?.scrollTop ?? 0
    const cleaned = normalizeMarkdown(md)
    lastMdRef.current = cleaned
    seedingRef.current = true
    userEditedRef.current = false
    el.innerHTML = markdownToHtml(cleaned)
    if (scroller) scroller.scrollTop = top
    // Ignore browser "input" events caused by innerHTML assignment
    requestAnimationFrame(() => {
      seedingRef.current = false
    })
    if (cleaned !== md) {
      onSelectRef.current?.(null)
      onChangeRef.current(cleaned)
    }
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const keyChanged = seededKeyRef.current !== docKey
    if (keyChanged) {
      seededKeyRef.current = docKey || ''
      seedHtml(text)
      return
    }
    if (text === lastMdRef.current && el.innerHTML.trim()) return
    seedHtml(text)
  }, [text, docKey])

  useLayoutEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const emit = (final = false) => {
      const el = ref.current
      const cb = onSelectRef.current
      if (!el || !cb) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const inPreview =
        el.contains(sel.anchorNode) || el.contains(sel.focusNode)
      if (!inPreview) return
      if (sel.isCollapsed) {
        cb(null)
        return
      }
      cb(previewSelectionToMdRange(el, lastMdRef.current), { final })
    }
    const onSelChange = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        emit(false)
      })
    }
    const onMouseUp = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      emit(true)
    }
    document.addEventListener('selectionchange', onSelChange)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onSelChange)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const commitFromDom = (immediate = false) => {
    const el = ref.current
    if (!el || disabled || !userEditedRef.current || seedingRef.current) return
    const run = () => {
      const md = htmlToMarkdown(el.innerHTML, { loose: true })
      const next = normalizeMarkdown(
        md ??
          ((el.textContent || '').trim() ? lastMdRef.current : ''),
      )
      if (next === lastMdRef.current) return
      lastMdRef.current = next
      onSelectRef.current?.(null)
      onChangeRef.current(next)
    }
    if (immediate) {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      run()
      return
    }
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(run, 320)
  }

  const pinScroll = () => {
    const scroller = getPreviewScroller(ref.current)
    pinnedScrollRef.current = scroller?.scrollTop ?? null
  }

  const restoreScroll = () => {
    const scroller = getPreviewScroller(ref.current)
    const top = pinnedScrollRef.current
    if (!scroller || top == null) return
    scroller.scrollTop = top
    requestAnimationFrame(() => {
      if (pinnedScrollRef.current != null) {
        scroller.scrollTop = pinnedScrollRef.current
      }
      ensureCaretVisible(scroller)
      pinnedScrollRef.current = null
    })
  }

  return (
    <div
      ref={ref}
      className={`report-md report-md--editable ${className || ''}`.trim()}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      aria-label="Sửa nội dung báo cáo (WYSIWYG)"
      spellCheck={false}
      onBlur={() => commitFromDom(true)}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' ||
          e.key === 'Backspace' ||
          e.key === 'Delete'
        ) {
          pinScroll()
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          e.preventDefault()
          userEditedRef.current = true
          document.execCommand('bold')
          commitFromDom(false)
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
          e.preventDefault()
          userEditedRef.current = true
          document.execCommand('italic')
          commitFromDom(false)
        }
      }}
      onInput={() => {
        if (seedingRef.current) return
        userEditedRef.current = true
        if (pinnedScrollRef.current != null) restoreScroll()
        commitFromDom(false)
      }}
      onPaste={(e) => {
        e.preventDefault()
        if (seedingRef.current) return
        userEditedRef.current = true
        pinScroll()
        const html = e.clipboardData.getData('text/html')
        const plain = e.clipboardData.getData('text/plain')
        if (html && html.trim()) {
          const md = htmlToMarkdown(html, { loose: true })
          if (md) {
            document.execCommand('insertHTML', false, markdownToHtml(md))
          } else {
            document.execCommand('insertText', false, plain || '')
          }
        } else {
          document.execCommand('insertText', false, plain || '')
        }
        restoreScroll()
        commitFromDom(true)
      }}
    />
  )
}

export function EditableReportPreview({
  text,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'Click vào đây để sửa nội dung…',
  docKey = '',
  wysiwyg = false,
  onSelectMdRange,
}: Props) {
  // Default: React markdown renderer — images always visible (same as public report)
  if (!wysiwyg) {
    return (
      <div
        className={`akr-live-md ${className}`.trim()}
        data-doc-key={docKey}
        // Selection sync still works on rendered DOM
        onMouseUp={() => {
          if (!onSelectMdRange) return
          const root = document.querySelector(
            '.akr-live-md .report-md',
          ) as HTMLElement | null
          if (!root) return
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed || !sel.rangeCount) {
            onSelectMdRange(null)
            return
          }
          if (!root.contains(sel.anchorNode) && !root.contains(sel.focusNode)) {
            return
          }
          onSelectMdRange(previewSelectionToMdRange(root, text), {
            final: true,
          })
        }}
      >
        <ReportMarkdown
          text={text}
          className="report-md--preview report-md--live"
          eagerImages
        />
      </div>
    )
  }

  return (
    <WysiwygBody
      text={text}
      onChange={onChange}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      docKey={docKey}
      onSelectMdRange={onSelectMdRange}
    />
  )
}

/** True if focus is inside the WYSIWYG preview editor */
export function isPreviewEditFocused(): boolean {
  const ae = document.activeElement
  return !!(ae && ae.closest && ae.closest('.report-md--editable'))
}
