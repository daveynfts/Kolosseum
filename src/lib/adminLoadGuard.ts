import { useEffect, useRef } from 'react'

/** Shared dirty flag so async server load cannot clobber in-progress edits. */
export function useDirtyRef(dirty: boolean) {
  const ref = useRef(dirty)
  useEffect(() => {
    ref.current = dirty
  }, [dirty])
  return ref
}

export function confirmDiscardUnsaved(dirty: boolean, message?: string): boolean {
  if (!dirty) return true
  return window.confirm(
    message ||
      'Có thay đổi chưa lưu. Tiếp tục sẽ mất bản nháp. Tiếp tục?',
  )
}

/**
 * Load remote dataset once on mount. Skips apply() if the user already edited.
 */
export function useRemoteDatasetLoad<T>(
  load: () => Promise<T>,
  dirtyRef: { current: boolean },
  apply: (data: T) => void,
): void {
  useEffect(() => {
    let cancelled = false
    void load().then((data) => {
      if (cancelled || dirtyRef.current) return
      apply(data)
    })
    return () => {
      cancelled = true
    }
    // Mount-only by design (same as Admin Dashboard KOL load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
