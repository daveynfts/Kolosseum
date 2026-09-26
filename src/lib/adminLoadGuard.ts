import { useEffect, useRef, useState } from 'react'

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
    }).catch(() => {
      /* Loaders should not reject; ignore so a throw cannot hang the editor. */
    })
    return () => {
      cancelled = true
    }
    // Mount-only by design (same as Admin Dashboard KOL load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export type AdminDatasetId =
  | 'kols'
  | 'feed'
  | 'follows'
  | 'twitterscore'
  | 'scex'
  | 'banner'
  | 'reports'
  | 'events'

export type AdminOpsSnapshot = {
  dirty: boolean
  saving: boolean
  source: string
  updatedAt: string | null
  save: () => void | Promise<void>
  reload: () => void | Promise<void>
}

const opsMap = new Map<AdminDatasetId, AdminOpsSnapshot>()
const opsListeners = new Set<() => void>()

function emitOps() {
  opsListeners.forEach((l) => l())
}

export function registerAdminOps(
  id: AdminDatasetId,
  snap: AdminOpsSnapshot | null,
) {
  if (!snap) opsMap.delete(id)
  else opsMap.set(id, snap)
  emitOps()
}

export function getAdminOps(id: AdminDatasetId | null): AdminOpsSnapshot | null {
  if (!id) return null
  return opsMap.get(id) ?? null
}

export function isDatasetDirty(id: AdminDatasetId): boolean {
  return opsMap.get(id)?.dirty === true
}

export function isAnyAdminDirty(): boolean {
  for (const snap of opsMap.values()) {
    if (snap.dirty) return true
  }
  return false
}

export function datasetForAdminTab(tab: string): AdminDatasetId | null {
  switch (tab) {
    case 'list':
    case 'edit':
      return 'kols'
    case 'feed':
      return 'feed'
    case 'follows':
      return 'follows'
    case 'data':
      return 'twitterscore'
    case 'scex':
      return 'scex'
    case 'banner':
      return 'banner'
    case 'reports':
      return 'reports'
    case 'events':
      return 'events'
    default:
      return null
  }
}

export type AdminTab =
  | 'list'
  | 'edit'
  | 'feed'
  | 'follows'
  | 'data'
  | 'scex'
  | 'banner'
  | 'reports'
  | 'events'
  | 'ops'
  | 'research'
  | 'legend'

const TAB_SUFFIX: Record<string, AdminTab> = {
  admin: 'list',
  list: 'list',
  edit: 'edit',
  feed: 'feed',
  follows: 'follows',
  followers: 'follows',
  data: 'data',
  twitterscore: 'data',
  'ts-data': 'data',
  scex: 'scex',
  campaign: 'scex',
  banner: 'banner',
  ribbon: 'banner',
  reports: 'reports',
  'kol-report': 'reports',
  'kol-reports': 'reports',
  'surf-report': 'reports',
  events: 'events',
  conviction: 'events',
  'side-event': 'events',
  'side-events': 'events',
  ops: 'ops',
  research: 'research',
  health: 'ops',
  legend: 'legend',
}

/** Last path segment only — `#/admin/data` is TwitterScore, not Feed. */
export function parseAdminTabFromHash(hash: string): AdminTab {
  const raw = hash.replace(/^#\/?/, '').toLowerCase()
  const qIndex = raw.indexOf('?')
  const pathPart = qIndex >= 0 ? raw.slice(0, qIndex) : raw
  const queryPart = qIndex >= 0 ? raw.slice(qIndex + 1) : ''
  const params = new URLSearchParams(queryPart)
  const tabParam = (params.get('tab') || '').toLowerCase()
  if (tabParam && TAB_SUFFIX[tabParam]) return TAB_SUFFIX[tabParam]
  const parts = pathPart.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || 'admin'
  return TAB_SUFFIX[last] || 'list'
}

/** Subscribe to ops registry so the sticky bar re-renders. */
export function useAdminOps(id: AdminDatasetId | null): AdminOpsSnapshot | null {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    opsListeners.add(l)
    return () => {
      opsListeners.delete(l)
    }
  }, [])
  return getAdminOps(id)
}

/** Register this editor's save/reload/dirty with the admin ops bar. */
export function useRegisterAdminOps(
  id: AdminDatasetId,
  snap: {
    dirty: boolean
    saving: boolean
    source: string
    updatedAt?: string | null
    save: () => void | Promise<void>
    reload: () => void | Promise<void>
  },
) {
  const saveRef = useRef(snap.save)
  const reloadRef = useRef(snap.reload)
  saveRef.current = snap.save
  reloadRef.current = snap.reload

  useEffect(() => {
    registerAdminOps(id, {
      dirty: snap.dirty,
      saving: snap.saving,
      source: snap.source,
      updatedAt: snap.updatedAt ?? null,
      save: () => saveRef.current(),
      reload: () => reloadRef.current(),
    })
    return () => registerAdminOps(id, null)
  }, [id, snap.dirty, snap.saving, snap.source, snap.updatedAt])
}
