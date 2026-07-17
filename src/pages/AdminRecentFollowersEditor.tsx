import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecentFollower } from '../data/recentFollowers'
import type { Kol } from '../types'
import {
  clearRecentFollowersOverride,
  exportRecentFollowersJson,
  getRecentFollowersFor,
  importRecentFollowersJson,
  listKolHandlesWithFollowers,
  loadRecentFollowersMap,
  loadRecentFollowersWithSource,
  saveRecentFollowersToServer,
  seedRecentFollowersMap,
  setRecentFollowersFor,
  type RecentFollowersMap,
} from '../lib/recentFollowersStore'
import {
  getTwitterScoreAccount,
  type TwitterScoreAccount,
} from '../data/twitterScoreTop100'
import {
  getTwitterScoreAccounts,
  loadTwitterScoreWithSource,
} from '../lib/twitterScoreStore'
import { getAdminToken } from '../lib/feedStore'
import { AvatarImg } from '../components/AvatarImg'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { NICHE_COLORS, primaryNiche } from '../types'
import { handleNameMatches } from '../lib/adminSearch'

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
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [tsAccounts, setTsAccounts] = useState<TwitterScoreAccount[]>(() =>
    getTwitterScoreAccounts(),
  )

  useEffect(() => {
    let cancelled = false
    void loadRecentFollowersWithSource().then((r) => {
      if (cancelled) return
      setMap(r.map)
      setSource(r.source)
    })
    void loadTwitterScoreWithSource().then((r) => {
      if (cancelled) return
      setTsAccounts(r.dataset.accounts)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const kolHandles = useMemo(() => {
    const fromKols = kols
      .filter((k) => !k.hidden)
      .map((k) => k.handle)
      .sort((a, b) => a.localeCompare(b))
    const fromMap = listKolHandlesWithFollowers(map)
    const set = new Set([...fromMap, ...fromKols.map((h) => h.toLowerCase())])
    const byLower = new Map(kols.map((k) => [k.handle.toLowerCase(), k.handle]))
    return [...set]
      .map((h) => byLower.get(h) || h)
      .sort((a, b) => a.localeCompare(b))
  }, [kols, map])

  const filteredHandles = useMemo(() => {
    if (!query.trim()) return kolHandles
    return kolHandles.filter((h) => {
      const kol = kols.find((k) => k.handle.toLowerCase() === h.toLowerCase())
      return handleNameMatches(h, kol?.displayName, query)
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

  const onSaveKol = async () => {
    if (!selectedKol) return
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN rồi Save (publish R2)')
      return
    }
    const cleaned = draft
      .map((f) => ({
        ...f,
        handle: f.handle.replace(/^@/, '').trim(),
        displayName: f.displayName.trim() || f.handle.replace(/^@/, '').trim(),
        followedAgo: f.followedAgo.trim() || 'recently',
      }))
      .filter((f) => f.handle)
    const next = setRecentFollowersFor(map, selectedKol, cleaned)
    setSaving(true)
    const result = await saveRecentFollowersToServer(
      next,
      `admin edit @${selectedKol}`,
      token,
    )
    setSaving(false)
    if (!result.ok) {
      onToast(`Publish R2 thất bại: ${result.error}`)
      return
    }
    setMap(result.map)
    setDraft(cleaned)
    setDirty(false)
    setSource('server')
    onToast(`Đã publish Smart Followers @${selectedKol} lên R2`)
  }

  const onReload = () => {
    void loadRecentFollowersWithSource().then((r) => {
      setMap(r.map)
      setSource(r.source)
      if (selectedKol) {
        setDraft(
          getRecentFollowersFor(selectedKol, r.map).map((f) => ({ ...f })),
        )
        setDirty(false)
      }
      onToast(`Reloaded from ${r.source}`)
    })
  }

  const onResetSeed = () => {
    if (
      !confirm(
        'Reset về seed trong code (recentFollowers.ts)? Cần Save để publish seed lên R2 nếu muốn website dùng seed.',
      )
    )
      return
    clearRecentFollowersOverride()
    const m = seedRecentFollowersMap()
    setMap(m)
    setSource('seed')
    if (selectedKol) {
      setDraft(getRecentFollowersFor(selectedKol, m).map((f) => ({ ...f })))
    }
    setDirty(true)
    onToast('Đã load seed — bấm Save để publish R2')
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
      setMap(imported)
      setSource('seed')
      if (selectedKol) {
        setDraft(
          getRecentFollowersFor(selectedKol, imported).map((f) => ({ ...f })),
        )
      }
      setDirty(true)
      onToast(
        `Imported ${Object.keys(imported).length} KOL keys — bấm Save để publish R2`,
      )
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const selectedKolMeta = kols.find(
    (k) => k.handle.toLowerCase() === selectedKol.toLowerCase(),
  )

  const draftInTop = useMemo(() => {
    let n = 0
    for (const f of draft) {
      if (f.handle && getTwitterScoreAccount(f.handle, tsAccounts)) n++
    }
    return n
  }, [draft, tsAccounts])

  return (
    <div className="admin-feed">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>Smart Followers</strong>
        <span>
          Snapshot Recent / Smart trên map theo từng KOL.{' '}
          <strong>Save = publish R2</strong>. Source: <strong>{source}</strong>.
          Đối chiếu TwitterScore → tab <strong>★ Data / TwitterScore</strong>.
        </span>
        <label className="admin-token-row">
          Token
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="FEED_ADMIN_TOKEN"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="admin-feed-toolbar glass">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSaveKol()}
          disabled={!selectedKol || saving}
        >
          {saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onAddRow}
          disabled={!selectedKol}
        >
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
          {selectedKol
            ? ` · draft ${draftInTop}/${draft.length} in TwitterScore list`
            : ''}
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-edit-layout">
        <div className="admin-edit-side glass">
          <div className="admin-side-list-head">
            <strong>KOL ({filteredHandles.length})</strong>
          </div>
          <div className="admin-toolbar" style={{ margin: '0 10px 4px' }}>
            <label className="admin-search-wrap">
              <span className="admin-search-wrap__icon" aria-hidden>
                ⌕
              </span>
              <input
                type="text"
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm @handle, tên…"
                aria-label="Search KOL"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="admin-search-wrap__clear"
                  title="Xóa tìm kiếm"
                  onClick={() => setQuery('')}
                >
                  ×
                </button>
              )}
            </label>
          </div>
          <ul className="admin-side-list">
            {filteredHandles.length === 0 && (
              <li className="admin-empty admin-empty--side">
                {query.trim()
                  ? `Không khớp “${query.trim()}”`
                  : 'Chưa có KOL'}
              </li>
            )}
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
                        kol ? NICHE_COLORS[primaryNiche(kol)] : '#64748b'
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
                    {draft.length} followers · {draftInTop} trong TwitterScore
                    list · map “Smart Followers”
                  </div>
                </div>
                {dirty && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void onSaveKol()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save (R2)'}
                  </button>
                )}
              </div>

              {draft.length === 0 ? (
                <p className="muted">
                  Chưa có follower — bấm <strong>+ Add follower</strong>. Xem
                  list TwitterScore ở tab <strong>★ Data</strong>.
                </p>
              ) : (
                <div className="admin-sf-list">
                  {draft.map((f, i) => {
                    const ts = f.handle
                      ? getTwitterScoreAccount(f.handle, tsAccounts)
                      : undefined
                    return (
                      <div
                        key={i}
                        className={`admin-sf-row glass ${ts ? 'admin-sf-row--top100' : ''}`}
                      >
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
                                patchFollower(i, {
                                  displayName: e.target.value,
                                })
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
                                patchFollower(i, {
                                  followedAgo: e.target.value,
                                })
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
                          {ts && (
                            <div className="admin-sf-ts-badge">
                              TwitterScore #{ts.rank} · {ts.score}/1000
                            </div>
                          )}
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
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
