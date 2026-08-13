import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecentFollower, SmartFollower } from '../data/recentFollowers'
import type { Kol } from '../types'
import {
  clearRecentFollowersOverride,
  getRecentFollowersFor,
  getSmartFollowersFor,
  importRecentFollowersJson,
  listKolHandlesWithFollowers,
  listKolHandlesWithSmartFollowers,
  loadRecentFollowersMap,
  loadRecentFollowersWithSource,
  loadSmartFollowersMap,
  normalizeSmartMap,
  saveRecentFollowersToServer,
  seedRecentFollowersMap,
  seedSmartFollowersMap,
  setRecentFollowersFor,
  setSmartFollowersFor,
  type RecentFollowersMap,
  type SmartFollowersMap,
} from '../lib/recentFollowersStore'
import {
  getTwitterScoreAccount,
  type TwitterScoreAccount,
} from '../data/twitterScoreTop100'
import {
  getTwitterScoreAccounts,
  loadTwitterScoreWithSource,
} from '../lib/twitterScoreStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import { AvatarImg } from '../components/AvatarImg'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { NICHE_COLORS, primaryNiche } from '../types'
import { handleNameMatches } from '../lib/adminSearch'
import {
  confirmDiscardUnsaved,
  useDirtyRef,
  useRegisterAdminOps,
  useRemoteDatasetLoad,
} from '../lib/adminLoadGuard'

interface Props {
  kols: Kol[]
  onToast: (msg: string) => void
}

type EditTab = 'recent' | 'smart'

function emptyRecentFollower(): RecentFollower {
  return {
    handle: '',
    displayName: '',
    followedAgo: 'a month ago',
    followedAt: new Date().toISOString(),
  }
}

function emptySmartFollower(): SmartFollower {
  return {
    handle: '',
    displayName: '',
    role: '',
    influenceScore: 500,
  }
}

export function AdminRecentFollowersEditor({ kols, onToast }: Props) {
  const [map, setMap] = useState<RecentFollowersMap>(() => loadRecentFollowersMap())
  const [smartMap, setSmartMap] = useState<SmartFollowersMap>(() =>
    loadSmartFollowersMap(),
  )
  const [selectedKol, setSelectedKol] = useState<string>('')
  const [editTab, setEditTab] = useState<EditTab>('recent')
  const [recentDraft, setRecentDraft] = useState<RecentFollower[]>([])
  const [smartDraft, setSmartDraft] = useState<SmartFollower[]>([])
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useDirtyRef(dirty)
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [tsAccounts, setTsAccounts] = useState<TwitterScoreAccount[]>(() =>
    getTwitterScoreAccounts(),
  )

  const applyLoad = useCallback(
    (r: Awaited<ReturnType<typeof loadRecentFollowersWithSource>>) => {
      setMap(r.map)
      setSmartMap(r.smartMap)
      setSource(r.source)
      setServerUpdatedAt(r.updatedAt)
    },
    [],
  )

  useRemoteDatasetLoad(loadRecentFollowersWithSource, dirtyRef, applyLoad)
  useEffect(() => {
    let cancelled = false
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
    const fromMap = [
      ...listKolHandlesWithFollowers(map),
      ...listKolHandlesWithSmartFollowers(smartMap),
    ]
    const set = new Set([...fromMap, ...fromKols.map((h) => h.toLowerCase())])
    const byLower = new Map(kols.map((k) => [k.handle.toLowerCase(), k.handle]))
    return [...set]
      .map((h) => byLower.get(h) || h)
      .sort((a, b) => a.localeCompare(b))
  }, [kols, map, smartMap])

  const filteredHandles = useMemo(() => {
    if (!query.trim()) return kolHandles
    return kolHandles.filter((h) => {
      const kol = kols.find((k) => k.handle.toLowerCase() === h.toLowerCase())
      return handleNameMatches(h, kol?.displayName, query)
    })
  }, [kolHandles, kols, query])

  const loadDraftsFor = useCallback(
    (handle: string, m: RecentFollowersMap, sm: SmartFollowersMap) => {
      setRecentDraft(getRecentFollowersFor(handle, m).map((f) => ({ ...f })))
      setSmartDraft(getSmartFollowersFor(handle, sm).map((f) => ({ ...f })))
    },
    [],
  )

  const selectKol = useCallback(
    (handle: string) => {
      if (dirty && selectedKol) {
        const tabLabel = editTab === 'smart' ? 'Smart' : 'Recent'
        if (
          !confirm(
            `Chưa lưu ${tabLabel} Followers của @${selectedKol}. Đổi KOL và bỏ thay đổi?`,
          )
        ) {
          return
        }
      }
      setSelectedKol(handle)
      loadDraftsFor(handle, map, smartMap)
      setDirty(false)
    },
    [dirty, map, smartMap, selectedKol, editTab, loadDraftsFor],
  )

  useEffect(() => {
    if (!selectedKol && kolHandles.length) {
      const preferred =
        listKolHandlesWithFollowers(map)[0] ||
        listKolHandlesWithSmartFollowers(smartMap)[0] ||
        kolHandles[0]
      selectKol(preferred)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kolHandles.length])

  const patchRecent = (index: number, patch: Partial<RecentFollower>) => {
    setRecentDraft((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    )
    setDirty(true)
  }

  const patchSmart = (index: number, patch: Partial<SmartFollower>) => {
    setSmartDraft((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    )
    setDirty(true)
  }

  const onAddRow = () => {
    if (editTab === 'smart') {
      setSmartDraft((prev) => [...prev, emptySmartFollower()])
    } else {
      setRecentDraft((prev) => [...prev, emptyRecentFollower()])
    }
    setDirty(true)
  }

  const onRemoveRow = (index: number) => {
    if (editTab === 'smart') {
      setSmartDraft((prev) => prev.filter((_, i) => i !== index))
    } else {
      setRecentDraft((prev) => prev.filter((_, i) => i !== index))
    }
    setDirty(true)
  }

  const onSaveKol = async () => {
    if (!selectedKol) return
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops rồi Save (publish R2)')
      return
    }
    setAdminToken(token)

    const cleanedRecent = recentDraft
      .map((f) => ({
        ...f,
        handle: f.handle.replace(/^@/, '').trim(),
        displayName: f.displayName.trim() || f.handle.replace(/^@/, '').trim(),
        followedAgo: f.followedAgo.trim() || 'recently',
        score:
          typeof f.score === 'number' && Number.isFinite(f.score)
            ? f.score
            : undefined,
      }))
      .filter((f) => f.handle)

    const cleanedSmart = smartDraft
      .map((f) => ({
        ...f,
        handle: f.handle.replace(/^@/, '').trim(),
        displayName: f.displayName.trim() || f.handle.replace(/^@/, '').trim(),
        role: (f.role || '').trim() || undefined,
        followers:
          typeof f.followers === 'number' && Number.isFinite(f.followers)
            ? f.followers
            : undefined,
        influenceScore:
          typeof f.influenceScore === 'number' &&
          Number.isFinite(f.influenceScore)
            ? f.influenceScore
            : undefined,
      }))
      .filter((f) => f.handle)

    const nextMap = setRecentFollowersFor(map, selectedKol, cleanedRecent)
    const nextSmart = setSmartFollowersFor(smartMap, selectedKol, cleanedSmart)

    setSaving(true)
    const result = await saveRecentFollowersToServer(
      nextMap,
      `admin edit @${selectedKol}`,
      token,
      nextSmart,
      serverUpdatedAt ?? undefined,
    )
    setSaving(false)
    if (!result.ok) {
      onToast(`Publish R2 thất bại: ${result.error}`)
      return
    }
    setMap(result.map)
    setSmartMap(result.smartMap)
    setRecentDraft(cleanedRecent)
    setSmartDraft(cleanedSmart)
    setDirty(false)
    setSource('server')
    setServerUpdatedAt(result.updatedAt)
    onToast(`Đã publish followers @${selectedKol} lên R2`)
  }

  const onReload = () => {
    if (!confirmDiscardUnsaved(dirty)) return
    void loadRecentFollowersWithSource().then((r) => {
      applyLoad(r)
      if (selectedKol) {
        loadDraftsFor(selectedKol, r.map, r.smartMap)
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
    const sm = seedSmartFollowersMap()
    setMap(m)
    setSmartMap(sm)
    setSource('seed')
    setServerUpdatedAt(null)
    if (selectedKol) loadDraftsFor(selectedKol, m, sm)
    setDirty(true)
    onToast('Đã load seed — bấm Save để publish R2')
  }

  const onExport = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, map, smartMap, updatedAt: serverUpdatedAt },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
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
      const parsed = JSON.parse(text) as
        | RecentFollowersMap
        | { map?: RecentFollowersMap; smartMap?: SmartFollowersMap }
      const importedMap =
        parsed && typeof parsed === 'object' && 'map' in parsed && parsed.map
          ? importRecentFollowersJson(JSON.stringify(parsed))
          : importRecentFollowersJson(text)
      const importedSmart =
        parsed &&
        typeof parsed === 'object' &&
        'smartMap' in parsed &&
        parsed.smartMap
          ? normalizeSmartMap(parsed.smartMap)
          : ({} as SmartFollowersMap)
      setMap(importedMap)
      setSmartMap(importedSmart)
      setSource('seed')
      setServerUpdatedAt(null)
      if (selectedKol) loadDraftsFor(selectedKol, importedMap, importedSmart)
      setDirty(true)
      onToast('Imported — bấm Save để publish R2')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const selectedKolMeta = kols.find(
    (k) => k.handle.toLowerCase() === selectedKol.toLowerCase(),
  )

  const draftInTop = useMemo(() => {
    let n = 0
    for (const f of recentDraft) {
      if (f.handle && getTwitterScoreAccount(f.handle, tsAccounts)) n++
    }
    return n
  }, [recentDraft, tsAccounts])

  const activeDraft = editTab === 'smart' ? smartDraft : recentDraft

  useRegisterAdminOps('follows', {
    dirty,
    saving,
    source,
    updatedAt: serverUpdatedAt,
    save: () => void onSaveKol(),
    reload: onReload,
  })

  return (
    <div className="admin-feed">
      <div className="admin-ai-banner" style={{ marginBottom: 12 }}>
        <strong>Followers (Recent + Smart)</strong>
        <span>
          Save = publish R2. {Object.keys(map).length} recent KOLs ·{' '}
          {Object.keys(smartMap).length} smart KOLs
          {serverUpdatedAt ? ` · ${serverUpdatedAt.slice(0, 19)}` : ''}.
        </span>
      </div>

      <div className="admin-feed-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSaveKol()}
          disabled={!selectedKol || saving || !dirty}
        >
          {saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onAddRow}
          disabled={!selectedKol}
        >
          + Add {editTab === 'smart' ? 'smart' : 'recent'}
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
          {Object.keys(map).length} recent KOLs ·{' '}
          {Object.keys(smartMap).length} smart KOLs
          {selectedKol
            ? ` · draft ${activeDraft.length}${editTab === 'recent' ? ` (${draftInTop} TS)` : ''}`
            : ''}
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`admin-tab ${editTab === 'recent' ? 'is-active' : ''}`}
          onClick={() => setEditTab('recent')}
        >
          Recent Followers
        </button>
        <button
          type="button"
          className={`admin-tab ${editTab === 'smart' ? 'is-active' : ''}`}
          onClick={() => setEditTab('smart')}
        >
          Smart Followers
        </button>
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
              const recentCount = getRecentFollowersFor(h, map).length
              const smartCount = getSmartFollowersFor(h, smartMap).length
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
                        {recentCount || smartCount
                          ? ` · R${recentCount} S${smartCount}`
                          : ' · empty'}
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
            <p className="muted">Chọn KOL bên trái để chỉnh followers.</p>
          ) : (
            <>
              <div className="admin-side-list-head" style={{ marginBottom: 12 }}>
                <div>
                  <strong>
                    @{selectedKol}
                    {selectedKolMeta ? ` · ${selectedKolMeta.displayName}` : ''}
                  </strong>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    {editTab === 'smart'
                      ? `${smartDraft.length} smart followers`
                      : `${recentDraft.length} recent · ${draftInTop} trong TwitterScore`}
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

              {activeDraft.length === 0 ? (
                <p className="muted">
                  Chưa có {editTab} follower — bấm <strong>+ Add</strong>.
                </p>
              ) : editTab === 'recent' ? (
                <div className="admin-sf-list">
                  {recentDraft.map((f, i) => {
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
                                patchRecent(i, { displayName: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Handle
                            <input
                              value={f.handle}
                              onChange={(e) =>
                                patchRecent(i, {
                                  handle: e.target.value.replace(/^@/, ''),
                                })
                              }
                            />
                          </label>
                          <label>
                            Thời gian (text)
                            <input
                              value={f.followedAgo}
                              onChange={(e) =>
                                patchRecent(i, { followedAgo: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            followedAt (ISO)
                            <input
                              value={f.followedAt || ''}
                              onChange={(e) =>
                                patchRecent(i, {
                                  followedAt: e.target.value || undefined,
                                })
                              }
                            />
                          </label>
                          <label>
                            Score (🏆)
                            <input
                              type="number"
                              value={f.score ?? ''}
                              onChange={(e) =>
                                patchRecent(i, {
                                  score: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                })
                              }
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
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="admin-sf-list">
                  {smartDraft.map((f, i) => (
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
                              patchSmart(i, { displayName: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Handle
                          <input
                            value={f.handle}
                            onChange={(e) =>
                              patchSmart(i, {
                                handle: e.target.value.replace(/^@/, ''),
                              })
                            }
                          />
                        </label>
                        <label className="admin-scex-span2">
                          Role / đánh giá tín hiệu
                          <textarea
                            value={f.role || ''}
                            rows={3}
                            onChange={(e) =>
                              patchSmart(i, { role: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Followers
                          <input
                            type="number"
                            value={f.followers ?? ''}
                            onChange={(e) =>
                              patchSmart(i, {
                                followers: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                        </label>
                        <label>
                          Influence score
                          <input
                            type="number"
                            value={f.influenceScore ?? ''}
                            onChange={(e) =>
                              patchSmart(i, {
                                influenceScore: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => onRemoveRow(i)}
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
