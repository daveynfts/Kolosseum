import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecentFollower } from '../data/recentFollowers'
import type { Kol } from '../types'
import {
  clearRecentFollowersOverride,
  exportRecentFollowersJson,
  getRecentFollowersFor,
  hasRecentFollowersOverride,
  importRecentFollowersJson,
  listKolHandlesWithFollowers,
  loadRecentFollowersMap,
  saveRecentFollowersMap,
  seedRecentFollowersMap,
  setRecentFollowersFor,
  type RecentFollowersMap,
} from '../lib/recentFollowersStore'
import { AvatarImg } from '../components/AvatarImg'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { NICHE_COLORS, primaryNiche } from '../types'

interface Props {
  kols: Kol[]
  onToast: (msg: string) => void
}

function emptyFollower(): RecentFollower {
  return {
    handle: '',
    displayName: '',
    followedAgo: 'a month ago',
    followedAt: new Date().toISOString(),
  }
}

export function AdminRecentFollowersEditor({ kols, onToast }: Props) {
  const [map, setMap] = useState<RecentFollowersMap>(() => loadRecentFollowersMap())
  const [selectedKol, setSelectedKol] = useState<string>('')
  const [draft, setDraft] = useState<RecentFollower[]>([])
  const [dirty, setDirty] = useState(false)
  const [isOverride, setIsOverride] = useState(() => hasRecentFollowersOverride())
  const [query, setQuery] = useState('')

  const kolHandles = useMemo(() => {
    const fromKols = kols
      .filter((k) => !k.hidden)
      .map((k) => k.handle)
      .sort((a, b) => a.localeCompare(b))
    const fromMap = listKolHandlesWithFollowers(map)
    const set = new Set([...fromMap, ...fromKols.map((h) => h.toLowerCase())])
    // Prefer original casing from kols
    const byLower = new Map(kols.map((k) => [k.handle.toLowerCase(), k.handle]))
    return [...set]
      .map((h) => byLower.get(h) || h)
      .sort((a, b) => a.localeCompare(b))
  }, [kols, map])

  const filteredHandles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return kolHandles
    return kolHandles.filter((h) => {
      const kol = kols.find((k) => k.handle.toLowerCase() === h.toLowerCase())
      return (
        h.toLowerCase().includes(q) ||
        (kol?.displayName || '').toLowerCase().includes(q)
      )
    })
  }, [kolHandles, kols, query])

  const selectKol = useCallback(
    (handle: string) => {
      if (dirty && selectedKol) {
        if (
          !confirm(
            `Chưa lưu Smart Followers của @${selectedKol}. Đổi KOL và bỏ thay đổi?`,
          )
        ) {
          return
        }
      }
      setSelectedKol(handle)
      setDraft(
        getRecentFollowersFor(handle, map).map((f) => ({
          ...f,
        })),
      )
      setDirty(false)
    },
    [dirty, map, selectedKol],
  )

  useEffect(() => {
    if (!selectedKol && kolHandles.length) {
      const preferred =
        listKolHandlesWithFollowers(map)[0] || kolHandles[0]
      selectKol(preferred)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kolHandles.length])

  const patchFollower = (index: number, patch: Partial<RecentFollower>) => {
    setDraft((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    )
    setDirty(true)
  }

  const onAddRow = () => {
    setDraft((prev) => [...prev, emptyFollower()])
    setDirty(true)
  }

  const onRemoveRow = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  const onSaveKol = () => {
    if (!selectedKol) return
    const cleaned = draft
      .map((f) => ({
        ...f,
        handle: f.handle.replace(/^@/, '').trim(),
        displayName: f.displayName.trim() || f.handle.replace(/^@/, '').trim(),
        followedAgo: f.followedAgo.trim() || 'recently',
      }))
      .filter((f) => f.handle)
    const next = setRecentFollowersFor(map, selectedKol, cleaned)
    const saved = saveRecentFollowersMap(next)
    setMap(saved)
    setDraft(cleaned)
    setDirty(false)
    setIsOverride(true)
    onToast(`Đã lưu Smart Followers @${selectedKol} (local)`)
  }

  const onReload = () => {
    const m = loadRecentFollowersMap()
    setMap(m)
    setIsOverride(hasRecentFollowersOverride())
    if (selectedKol) {
      setDraft(getRecentFollowersFor(selectedKol, m).map((f) => ({ ...f })))
      setDirty(false)
    }
    onToast('Reloaded Smart Followers')
  }

  const onResetSeed = () => {
    if (
      !confirm(
        'Xóa override local → dùng lại seed trong code (recentFollowers.ts)?',
      )
    )
      return
    clearRecentFollowersOverride()
    const m = seedRecentFollowersMap()
    setMap(m)
    setIsOverride(false)
    if (selectedKol) {
      setDraft(getRecentFollowersFor(selectedKol, m).map((f) => ({ ...f })))
    }
    setDirty(false)
    onToast('Đã reset về seed')
  }

  const onExport = () => {
    const blob = new Blob([exportRecentFollowersJson(map)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `recent-followers-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported JSON')
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const imported = importRecentFollowersJson(text)
      const saved = saveRecentFollowersMap(imported)
      setMap(saved)
      setIsOverride(true)
      if (selectedKol) {
        setDraft(getRecentFollowersFor(selectedKol, saved).map((f) => ({ ...f })))
      }
      setDirty(false)
      onToast(`Imported ${Object.keys(saved).length} KOL keys`)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const selectedKolMeta = kols.find(
    (k) => k.handle.toLowerCase() === selectedKol.toLowerCase(),
  )

  return (
    <div className="admin-feed">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>Smart Followers</strong>
        <span>
          Chỉnh snapshot “Recent follows” trên map (ai follow KOL). Lưu{' '}
          <em>local browser</em>
          {isOverride ? ' · đang dùng override' : ' · đang dùng seed code'}.
          Export JSON nếu muốn commit vào repo.
        </span>
      </div>

      <div className="admin-feed-toolbar glass">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSaveKol}
          disabled={!selectedKol || !dirty}
        >
          Save KOL
        </button>
        <button type="button" className="btn" onClick={onAddRow} disabled={!selectedKol}>
          + Add follower
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Export JSON
        </button>
        <label className="btn btn--file">
          Import
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </label>
        <button type="button" className="btn" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn btn--danger" onClick={onResetSeed}>
          Reset seed
        </button>
        <span className="admin-count" style={{ alignSelf: 'center' }}>
          {Object.keys(map).length} KOLs ·{' '}
          {Object.values(map).reduce((n, a) => n + a.length, 0)} followers
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-edit-layout">
        <div className="admin-edit-side glass">
          <div className="admin-side-list-head">
            <strong>KOL ({filteredHandles.length})</strong>
          </div>
          <input
            className="admin-search"
            style={{ margin: '8px 10px', width: 'calc(100% - 20px)' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search KOL…"
          />
          <ul className="admin-side-list">
            {filteredHandles.map((h) => {
              const count = getRecentFollowersFor(h, map).length
              const active = h.toLowerCase() === selectedKol.toLowerCase()
              const kol = kols.find(
                (k) => k.handle.toLowerCase() === h.toLowerCase(),
              )
              return (
                <li key={h}>
                  <button
                    type="button"
                    className={`admin-side-item ${active ? 'is-active' : ''}`}
                    onClick={() => selectKol(h)}
                  >
                    <AvatarImg
                      handle={h}
                      name={kol?.displayName || h}
                      size={28}
                      color={
                        kol
                          ? NICHE_COLORS[primaryNiche(kol)]
                          : '#64748b'
                      }
                    />
                    <span className="admin-side-item__text">
                      <strong>{kol?.displayName || h}</strong>
                      <small>
                        @{h}
                        {count ? ` · ${count}` : ' · empty'}
                      </small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="admin-edit-main glass">
          {!selectedKol ? (
            <p className="muted">Chọn KOL bên trái để chỉnh Smart Followers.</p>
          ) : (
            <>
              <div className="admin-side-list-head" style={{ marginBottom: 12 }}>
                <div>
                  <strong>
                    @{selectedKol}
                    {selectedKolMeta ? ` · ${selectedKolMeta.displayName}` : ''}
                  </strong>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    {draft.length} followers · map tab “Recent follows”
                  </div>
                </div>
                {dirty && (
                  <button type="button" className="btn btn--primary" onClick={onSaveKol}>
                    Save
                  </button>
                )}
              </div>

              {draft.length === 0 ? (
                <p className="muted">
                  Chưa có follower — bấm <strong>+ Add follower</strong>.
                </p>
              ) : (
                <div className="admin-sf-list">
                  {draft.map((f, i) => (
                    <div key={i} className="admin-sf-row glass">
                      <XProfileAvatar
                        handle={f.handle || 'user'}
                        name={f.displayName || f.handle || '?'}
                        size={36}
                      />
                      <div className="admin-sf-fields">
                        <label>
                          Display name
                          <input
                            value={f.displayName}
                            onChange={(e) =>
                              patchFollower(i, { displayName: e.target.value })
                            }
                            placeholder="Name"
                          />
                        </label>
                        <label>
                          Handle
                          <input
                            value={f.handle}
                            onChange={(e) =>
                              patchFollower(i, {
                                handle: e.target.value.replace(/^@/, ''),
                              })
                            }
                            placeholder="handle"
                          />
                        </label>
                        <label>
                          Thời gian
                          <input
                            value={f.followedAgo}
                            onChange={(e) =>
                              patchFollower(i, { followedAgo: e.target.value })
                            }
                            placeholder="a month ago"
                          />
                        </label>
                        <label>
                          followedAt (ISO, optional)
                          <input
                            value={f.followedAt || ''}
                            onChange={(e) =>
                              patchFollower(i, {
                                followedAt: e.target.value || undefined,
                              })
                            }
                            placeholder="2026-06-15T00:00:00.000Z"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => onRemoveRow(i)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
