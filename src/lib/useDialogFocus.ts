import { useEffect, type RefObject } from 'react'
export function useDialogFocus(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled || !ref.current) return
    const root = ref.current, previous = document.activeElement as HTMLElement | null
    const candidates = () => [...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')].filter(el => el.getClientRects().length > 0)
    candidates()[0]?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (!root.hasAttribute('data-wallet-dialog') && document.querySelector('[data-wallet-dialog]')) return
      const els = candidates(), first = els[0], last = els[els.length - 1]
      if (!first) { e.preventDefault(); root.focus(); return }
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus() }
      if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    root.addEventListener('keydown', key)
    return () => { root.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus() }
  }, [ref, enabled])
}
