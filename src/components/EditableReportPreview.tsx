/**
 * WYSIWYG report body — edit rendered preview, sync back to markdown.
 */
import { useLayoutEffect, useRef } from 'react'
import { htmlToMarkdown } from '../lib/htmlToMarkdown'
import { markdownToHtml } from '../lib/markdownToHtml'

interface Props {
  text: string
  onChange: (markdown: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
  /** Remount/resync key when switching reports */
  docKey?: string
}

export function EditableReportPreview({
  text,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'Click vào đây để sửa nội dung…',
  docKey = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)
  const lastMdRef = useRef(text)
  const debounceRef = useRef<number | null>(null)
  const seededKeyRef = useRef('')

  const seedHtml = (md: string) => {
    const el = ref.current
    if (!el) return
    lastMdRef.current = md
    el.innerHTML = markdownToHtml(md)
  }

  // Seed when report changes or external markdown updates (and not typing)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const keyChanged = seededKeyRef.current !== docKey
    if (keyChanged) {
      seededKeyRef.current = docKey
      focusedRef.current = false
      seedHtml(text)
      return
    }
    if (focusedRef.current) return
    if (text === lastMdRef.current && el.innerHTML.trim()) return
    seedHtml(text)
  }, [text, docKey])

  useLayoutEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const commitFromDom = (immediate = false) => {
    const el = ref.current
    if (!el || disabled) return
    const run = () => {
      const md = htmlToMarkdown(el.innerHTML, { loose: true })
      const next =
        md ??
        ((el.textContent || '').trim() ? lastMdRef.current : '')
      if (next === lastMdRef.current) return
      lastMdRef.current = next
      onChange(next)
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

  return (
    <div
      ref={ref}
      className={`report-md report-md--editable ${className}`.trim()}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      aria-label="Sửa nội dung báo cáo (Live Preview)"
      spellCheck={false}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={() => {
        focusedRef.current = false
        commitFromDom(true)
      }}
      onInput={() => commitFromDom(false)}
      onPaste={(e) => {
        e.preventDefault()
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
        commitFromDom(true)
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          e.preventDefault()
          document.execCommand('bold')
          commitFromDom(false)
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
          e.preventDefault()
          document.execCommand('italic')
          commitFromDom(false)
        }
      }}
    />
  )
}

/** True if focus is inside the WYSIWYG preview editor */
export function isPreviewEditFocused(): boolean {
  const ae = document.activeElement
  return !!(ae && ae.closest && ae.closest('.report-md--editable'))
}
