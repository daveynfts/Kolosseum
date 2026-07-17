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
  recomputeTwitterScoreStats,
  searchTwitterScoreTop100,
  type TwitterScoreAccount,
  type TwitterScoreDataset,
} from '../data/twitterScoreTop100'
import {
  clearTwitterScoreCache,
  exportTwitterScoreJson,
  importTwitterScoreJson,
  loadTwitterScoreWithSource,
  saveTwitterScoreToServer,
  seedTwitterScoreDataset,
} from '../lib/twitterScoreStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
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
  const [tsQuery, setTsQuery] = useState('')
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [tsDataset, setTsDataset] = useState<TwitterScoreDataset>(() =>
    seedTwitterScoreDataset(),
  )
  const [tsSource, setTsSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [tsDirty, setTsDirty] = useState(false)
  const [tsSaving, setTsSaving] = useState(false)
  const [tsEditHandle, setTsEditHandle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadRecentFollowersWithSource().then((r) => {
      if (cancelled) return
      setMap(r.map)
      setSource(r.source)
    })
    void loadTwitterScoreWithSource().then((r) => {
      if (cancelled) return
      setTsDataset(r.dataset)
      setTsSource(r.source)
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
    // Prefer original casing from kols
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

  const draftHandles = useMemo(
    () =>
      new Set(
        draft
          .map((f) => f.handle.replace(/^@/, '').trim().toLowerCase())
          .filter(Boolean),
      ),
    [draft],
  )

  const tsAccounts = tsDataset.accounts
  const tsList = useMemo(
    () => searchTwitterScoreTop100(tsQuery, tsAccounts),
    [tsQuery, tsAccounts],
  )

  const draftInTop100 = useMemo(() => {
    let n = 0
    for (const h of draftHandles) {
      if (getTwitterScoreAccount(h, tsAccounts)) n++
    }
    return n
  }, [draftHandles, tsAccounts])

  const onAddFromTwitterScore = (acc: TwitterScoreAccount) => {
    if (!selectedKol) {
      onToast('Chọn KOL bên trái trước')
      return
    }
    const h = acc.handle.toLowerCase()
    if (draftHandles.has(h)) {
      onToast(`@${acc.handle} đã có trong list`)
      return
    }
    setDraft((prev) => [
      ...prev,
      {
        handle: acc.handle,
        displayName: acc.displayName,
        followedAgo: 'TwitterScore top 100',
        followedAt: tsDataset.asOf,
      },
    ])
    setDirty(true)
    onToast(`Đã thêm @${acc.handle} (#${acc.rank} · ${acc.score})`)
  }

  const patchTsAccount = (
    handle: string,
    patch: Partial<TwitterScoreAccount>,
  ) => {
    setTsDataset((prev) => {
      const accounts = prev.accounts.map((a) =>
        a.handle.toLowerCase() === handle.toLowerCase()
          ? {
              ...a,
              ...patch,
              handle: (patch.handle ?? a.handle).replace(/^@/, '').trim(),
            }
          : a,
      )
      return recomputeTwitterScoreStats({ ...prev, accounts })
    })
    setTsDirty(true)
  }

  const onAddTsRow = () => {
    const handle = `new_account_${Date.now().toString(36).slice(-4)}`
    setTsDataset((prev) =>
      recomputeTwitterScoreStats({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            rank: prev.accounts.length + 1,
            handle,
            displayName: 'New account',
            score: prev.top100Threshold || 740,
          },
        ],
      }),
    )
    setTsEditHandle(handle)
    setTsDirty(true)
    setTsQuery(handle)
  }

  const onRemoveTsRow = (handle: string) => {
    if (!confirm(`Xóa @${handle} khỏi TwitterScore Top 100?`)) return
    setTsDataset((prev) =>
      recomputeTwitterScoreStats({
        ...prev,
        accounts: prev.accounts.filter(
          (a) => a.handle.toLowerCase() !== handle.toLowerCase(),
        ),
      }),
    )
    setTsDirty(true)
    if (tsEditHandle?.toLowerCase() === handle.toLowerCase()) {
      setTsEditHandle(null)
    }
  }

  const onSaveTwitterScore = async () => {
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN rồi Save Top 100')
      return
    }
    setAdminToken(token)
    setTsSaving(true)
    const result = await saveTwitterScoreToServer(
      tsDataset,
      'admin edit TwitterScore Top 100',
      token,
    )
    setTsSaving(false)
    if (!result.ok) {
      onToast(`Publish Top 100 thất bại: ${result.error}`)
      return
    }
    setTsDataset(result.dataset)
    setTsSource('server')
    setTsDirty(false)
    onToast(
      `Đã publish TwitterScore Top ${result.dataset.accounts.length} lên R2`,
    )
  }

  const onReloadTwitterScore = () => {
    void loadTwitterScoreWithSource().then((r) => {
      setTsDataset(r.dataset)
      setTsSource(r.source)
      setTsDirty(false)
      onToast(`Top 100 reloaded from ${r.source}`)
    })
  }

  const onResetTwitterScoreSeed = () => {
    if (!confirm('Reset TwitterScore Top 100 về seed JSON trong code?')) return
    clearTwitterScoreCache()
    const seed = seedTwitterScoreDataset()
    setTsDataset(seed)
    setTsSource('seed')
    setTsDirty(true)
    onToast('Đã load seed Top 100 — bấm Save Top 100 (R2) để publish')
  }

  const onExportTwitterScore = () => {
    const blob = new Blob([exportTwitterScoreJson(tsDataset)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `twitterscore-top100-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported Top 100 JSON (commit vào data/internal/ nếu cần)')
  }

  const onImportTwitterScore = async (file: File) => {
    try {
      const text = await file.text()
      const imported = importTwitterScoreJson(text)
      setTsDataset(imported)
      setTsSource('seed')
      setTsDirty(true)
      onToast(
        `Imported ${imported.accounts.length} accounts — Save Top 100 (R2)`,
      )
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import Top 100 failed')
    }
  }

  return (
    <div className="admin-feed">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>Smart Followers + internal Top 100</strong>
        <span>
          Recent/Smart per KOL (map) +{' '}
          <strong>TwitterScore Top 100</strong> là data nội bộ (seed JSON · R2{' '}
          <code>internal/twitterscore-top100/v1.json</code>). Followers source:{' '}
          <strong>{source}</strong> · Top100:{' '}
          <strong>{tsSource}</strong>
          {tsDirty ? ' · Top100 unsaved' : ''}. asOf{' '}
          {tsDataset.asOf.slice(0, 10)} · cut-off {tsDataset.top100Threshold} ·{' '}
          {tsDataset.accounts.length} accounts.
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
          {selectedKol
            ? ` · draft ${draftInTop100}/${draft.length} in TS top100`
            : ''}
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-edit-layout admin-edit-layout--sf3">
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
                    {draft.length} followers · {draftInTop100} trong TwitterScore
                    top 100 · map “Smart Followers”
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
                  Chưa có follower — bấm <strong>+ Add follower</strong> hoặc
                  chọn từ <strong>TwitterScore Top 100</strong> bên phải.
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

        {/* TwitterScore Top 100 — internal editable dataset */}
        <div className="admin-edit-side glass admin-ts-panel">
          <div className="admin-side-list-head">
            <strong>TwitterScore Top 100</strong>
            {tsDirty && (
              <span className="admin-ts-dirty" title="Unsaved">
                ·
              </span>
            )}
          </div>
          <p className="admin-ts-panel__note">
            Data nội bộ ({tsAccounts.length}) · source <strong>{tsSource}</strong>{' '}
            · mean {tsDataset.mean.toFixed(1)} · median {tsDataset.median} ·
            cut-off {tsDataset.top100Threshold}. Điểm ={' '}
            <em>network influence</em>, không = uy tín/trade. Seed:{' '}
            <code>data/internal/twitterscore-top100.json</code> · R2:{' '}
            <code>internal/twitterscore-top100/v1.json</code>.
          </p>
          <div className="admin-ts-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void onSaveTwitterScore()}
              disabled={tsSaving}
            >
              {tsSaving ? '…' : 'Save Top 100 (R2)'}
            </button>
            <button type="button" className="btn btn--sm" onClick={onAddTsRow}>
              + Row
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={onExportTwitterScore}
            >
              Export
            </button>
            <label className="btn btn--file btn--sm">
              Import
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onImportTwitterScore(f)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn--sm"
              onClick={onReloadTwitterScore}
            >
              Reload
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={onResetTwitterScoreSeed}
            >
              Seed
            </button>
          </div>
          <div className="admin-toolbar" style={{ margin: '0 10px 4px' }}>
            <label className="admin-search-wrap">
              <span className="admin-search-wrap__icon" aria-hidden>
                ⌕
              </span>
              <input
                type="text"
                className="admin-search"
                value={tsQuery}
                onChange={(e) => setTsQuery(e.target.value)}
                placeholder="Tìm #rank, @handle, điểm…"
                aria-label="Search TwitterScore top 100"
                autoComplete="off"
              />
              {tsQuery && (
                <button
                  type="button"
                  className="admin-search-wrap__clear"
                  title="Xóa tìm kiếm"
                  onClick={() => setTsQuery('')}
                >
                  ×
                </button>
              )}
            </label>
          </div>
          <ul className="admin-side-list admin-ts-list">
            {tsList.length === 0 && (
              <li className="admin-empty admin-empty--side">
                Không khớp “{tsQuery.trim()}”
              </li>
            )}
            {tsList.map((acc) => {
              const inDraft = draftHandles.has(acc.handle.toLowerCase())
              const editing =
                tsEditHandle?.toLowerCase() === acc.handle.toLowerCase()
              return (
                <li key={`${acc.rank}-${acc.handle}`}>
                  <div
                    className={`admin-ts-row ${inDraft ? 'is-in-draft' : ''} ${editing ? 'is-editing' : ''}`}
                  >
                    <span className="admin-ts-row__rank">#{acc.rank}</span>
                    <XProfileAvatar
                      handle={acc.handle}
                      name={acc.displayName}
                      size={28}
                    />
                    {editing ? (
                      <span className="admin-ts-row__edit">
                        <input
                          value={acc.displayName}
                          onChange={(e) =>
                            patchTsAccount(acc.handle, {
                              displayName: e.target.value,
                            })
                          }
                          placeholder="Name"
                        />
                        <input
                          value={acc.handle}
                          onChange={(e) =>
                            patchTsAccount(acc.handle, {
                              handle: e.target.value.replace(/^@/, ''),
                            })
                          }
                          placeholder="handle"
                        />
                        <input
                          type="number"
                          value={acc.score}
                          min={0}
                          max={1000}
                          onChange={(e) =>
                            patchTsAccount(acc.handle, {
                              score: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="score"
                        />
                      </span>
                    ) : (
                      <span className="admin-ts-row__meta">
                        <strong>{acc.displayName}</strong>
                        <small>@{acc.handle}</small>
                      </span>
                    )}
                    {!editing && (
                      <span
                        className={`admin-ts-row__score ${acc.score >= 1000 ? 'is-max' : ''}`}
                        title="TwitterScore"
                      >
                        {acc.score}
                      </span>
                    )}
                    <span className="admin-ts-row__btns">
                      <button
                        type="button"
                        className="btn btn--sm"
                        title={editing ? 'Done' : 'Edit'}
                        onClick={() =>
                          setTsEditHandle(editing ? null : acc.handle)
                        }
                      >
                        {editing ? '✓' : '✎'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={!selectedKol || inDraft}
                        title={
                          inDraft
                            ? 'Đã có trong list KOL'
                            : `Thêm @${acc.handle} vào draft`
                        }
                        onClick={() => onAddFromTwitterScore(acc)}
                      >
                        {inDraft ? '✓' : '+'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        title="Remove from Top 100"
                        onClick={() => onRemoveTsRow(acc.handle)}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
