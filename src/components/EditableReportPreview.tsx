/**
 * ContentEditable report body — edit rendered preview, sync back to markdown.
 */
import { useEffect, useRef } from 'react'
import { htmlToMarkdown } from '../lib/htmlToMarkdown'
import { markdownToHtml } from '../lib/markdownToHtml'

interface Props {
  text: string
  onChange: (markdown: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function EditableReportPreview({
  text,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'Viết nội dung report…',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)
  const lastMdRef = useRef(text)
  const debounceRef = useRef<number | null>(null)

  // Seed / resync HTML when external markdown changes and we're not typing
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (focusedRef.current) return
    if (text === lastMdRef.current && el.innerHTML) return
    lastMdRef.current = text
    el.innerHTML = markdownToHtml(text)
  }, [text])

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const commitFromDom = (immediate = false) => {
    const el = ref.current
    if (!el || disabled) return
    const run = () => {
      const md = htmlToMarkdown(el.innerHTML)
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
    debounceRef.current = window.setTimeout(run, 280)
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
      aria-label="Report body"
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={() => {
        focusedRef.current = false
        commitFromDom(true)
      }}
      onInput={() => commitFromDom(false)}
      onPaste={(e) => {
        // Prefer plain / HTML → markdown pipeline via default paste into
        // contentEditable, then commit; strip risky scripts by re-serializing.
        requestAnimationFrame(() => commitFromDom(true))
        void e
      }}
    />
  )
}
