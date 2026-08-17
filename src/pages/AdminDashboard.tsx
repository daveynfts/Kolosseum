import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Kol, KolRank, Niche, StatusLabel } from '../types'
import {
  applyKolRank,
  formatRank,
  getKolNiches,
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  RANK_LABELS,
  RANK_ORDER,
  STATUS_EMOJI,
  STATUS_LABELS,
  tierForRank,
} from '../types'
import { RankBadge } from '../components/RankBadge'
import {
  ADMIN_NICHES,
  ADMIN_STATUSES,
  clearKolsStore,
  createEmptyKol,
  exportKolsJson,
  getStoreMeta,
  importKolsJson,
  loadKols,
  loadKolsWithSource,
  recalculateScores,
  saveKolsToServer,
  type KolSource,
} from '../lib/kolStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import { FIELD_META, SOURCE_LABELS, type FieldSource } from '../lib/fieldMeta'
import { kolMatchesAdminQuery } from '../lib/adminSearch'
import { normalizeAvatarUrl, xAvatarUrl } from '../lib/avatar'
import {
  confirmDiscardUnsaved,
  datasetForAdminTab,
  isAnyAdminDirty,
  isDatasetDirty,
  parseAdminTabFromHash,
  useAdminOps,
  useRegisterAdminOps,
  type AdminDatasetId,
} from '../lib/adminLoadGuard'
import {
  suggestSurfReportFilename,
  uploadSurfReport,
} from '../lib/surfReportUpload'
import { AvatarImg } from '../components/AvatarImg'
import { AdminFeedEditor } from './AdminFeedEditor'
import { AdminRecentFollowersEditor } from './AdminRecentFollowersEditor'
import { AdminTwitterScoreEditor } from './AdminTwitterScoreEditor'
import { AdminScexEditor } from './AdminScexEditor'
import { AdminKolReportsEditor } from './AdminKolReportsEditor'
import { AdminBannerEditor } from './AdminBannerEditor'
import { AdminConvictionEventsEditor } from './AdminConvictionEventsEditor'
import './AdminDashboard.css'

type Tab =
  | 'list'
  | 'edit'
  | 'feed'
  | 'follows'
  | 'data'
  | 'scex'
  | 'banner'
  | 'reports'
  | 'events'
  | 'legend'

const TAB_HASH: Record<Tab, string> = {
  list: '#/admin',
  edit: '#/admin/edit',
  feed: '#/admin/feed',
  follows: '#/admin/follows',
  data: '#/admin/data',
  scex: '#/admin/scex',
  banner: '#/admin/banner',
  reports: '#/admin/reports',
  events: '#/admin/events',
  legend: '#/admin/legend',
}

const DATASET_FILE: Record<AdminDatasetId, string> = {
  kols: 'kols/v1.json',
  feed: 'feed/v1.json',
  follows: 'recent-followers/v1.json',
  twitterscore: 'internal/twitterscore-top100/v1.json',
  scex: 'scex/tracking/v1.json',
  banner: 'site/banner/v1.json',
  reports: 'internal/kol-reports/v1.json',
  events: 'events/{slug}/v1.json',
}

function tabFromHash(): Tab {
  return parseAdminTabFromHash(window.location.hash)
}

export function AdminDashboard() {
  const [kols, setKols] = useState<Kol[]>(() => loadKols())
  const [query, setQuery] = useState('')
  const [filterRank, setFilterRank] = useState<KolRank | 'All'>('All')
  const [filterStatus, setFilterStatus] = useState<StatusLabel | 'All'>('All')
  const [showHidden, setShowHidden] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Kol | null>(null)
  const [tab, setTab] = useState<Tab>(() => tabFromHash())
  const [toast, setToast] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [kolSource, setKolSource] = useState<KolSource | 'loading'>('loading')
  const [kolUpdatedAt, setKolUpdatedAt] = useState<string | null>(null)
  const [savingServer, setSavingServer] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [uploadingSurf, setUploadingSurf] = useState(false)
  const dirtyRef = useRef(dirty)
  const tabRef = useRef(tab)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  const applyHash = (t: Tab) => {
    const path = TAB_HASH[t]
    if (window.location.hash !== path) {
      window.location.hash = path
    }
  }

  const goTab = (t: Tab, opts?: { fromHash?: boolean }) => {
    const current = tabRef.current
    if (t === current) {
      if (!opts?.fromHash) applyHash(t)
      return
    }
    const fromDs = datasetForAdminTab(current)
    const toDs = datasetForAdminTab(t)
    if (fromDs && fromDs !== toDs) {
      const leavingDirty =
        isDatasetDirty(fromDs) || (fromDs === 'kols' && dirtyRef.current)
      if (leavingDirty && !confirmDiscardUnsaved(true)) {
        if (opts?.fromHash) applyHash(current)
        return
      }
    }
    setTab(t)
    tabRef.current = t
    if (!opts?.fromHash) applyHash(t)
  }

  useEffect(() => {
    const onHash = () => goTab(tabFromHash(), { fromHash: true })
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // goTab is stable enough via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAnyAdminDirty() || dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Load shared R2 copy first so admin sees same data as everyone
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { kols: list, source, updatedAt } = await loadKolsWithSource({
        includeHidden: true,
      })
      if (cancelled) return
      // Don't wipe in-progress local edits if user already changed something
      if (dirtyRef.current) {
        setKolSource(source)
        if (updatedAt) setKolUpdatedAt(updatedAt)
        return
      }
      setKols(list)
      setKolSource(source)
      setKolUpdatedAt(updatedAt ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const meta = getStoreMeta()

  // Keep draft in sync when list updates from R2 (only if not dirty)
  useEffect(() => {
    if (!selectedId || dirty) return
    const sel = kols.find((k) => k.id === selectedId)
    if (!sel) return
    setDraft((prev) => {
      if (prev && prev.id === sel.id && JSON.stringify(prev) === JSON.stringify(sel)) {
        return prev
      }
      return JSON.parse(JSON.stringify(sel)) as Kol
    })
  }, [kols, selectedId, dirty])

  const openKol = (id: string) => {
    if (dirty && draft && draft.id !== id) {
      if (
        !confirm(
          'Có thay đổi chưa Save (R2). Bỏ qua và chuyển sang KOL khác?',
        )
      ) {
        return
      }
      setDirty(false)
    }
    setSelectedId(id)
    const sel = kols.find((k) => k.id === id)
    if (sel) setDraft(JSON.parse(JSON.stringify(sel)) as Kol)
    goTab('edit')
  }

  const filtered = useMemo(() => {
    return kols
      .filter((k) => {
        if (!showHidden && k.hidden) return false
        if (filterRank !== 'All' && getKolRank(k) !== filterRank) return false
        if (filterStatus !== 'All' && k.statusLabel !== filterStatus) return false
        return kolMatchesAdminQuery(k, query)
      })
      .sort((a, b) => b.score - a.score)
  }, [kols, query, filterRank, filterStatus, showHidden])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const persistServer = useCallback(
    async (next: Kol[], note?: string): Promise<boolean> => {
      setSavingServer(true)
      try {
        const token = tokenInput.trim() || getAdminToken()
        if (!token) {
          flash(
            'Chưa có token — dán FEED_ADMIN_TOKEN ở thanh ops rồi Save (R2).',
          )
          return false
        }
        setAdminToken(token)
        const result = await saveKolsToServer(next, note, token)
        if (!result.ok) {
          setKolSource('local')
          flash(`Publish R2 thất bại: ${result.error}`)
          return false
        }
        setKols(result.kols)
        setDirty(false)
        setKolSource('server')
        setKolUpdatedAt(result.updatedAt)
        const withPdf = result.kols.filter((k) => (k.surfReportPdfUrl || '').trim())
          .length
        flash(
          `Đã publish R2 (${result.count} KOLs · ${withPdf} có Surf PDF) — hard-refresh map để thấy.`,
        )
        return true
      } finally {
        setSavingServer(false)
      }
    },
    [tokenInput],
  )

  const buildFixedDraft = (src: Kol): Kol => {
    const niches = getKolNiches(src)
    return recalculateScores({
      ...src,
      handle: src.handle.replace(/^@/, '').trim(),
      niches,
      niche: niches[0] ?? 'Multi',
      dataSource: src.dataSource === 'x-live' ? 'x-live+admin' : 'admin',
    })
  }

  const onSaveDraft = (override?: Kol) => {
    const src = override ?? draft
    if (!src) return
    const fixed = buildFixedDraft(src)
    const next = kols.some((k) => k.id === fixed.id)
      ? kols.map((k) => (k.id === fixed.id ? fixed : k))
      : [...kols, fixed]
    setDraft(fixed)
    setSelectedId(fixed.id)
    void persistServer(next, `admin edit @${fixed.handle} tier=${fixed.tier}`)
  }

  const patchKolInList = (id: string, nextKol: Kol) => {
    setKols((prev) => prev.map((k) => (k.id === id ? nextKol : k)))
    setDirty(true)
    setDraft((prev) => (prev && prev.id === id ? nextKol : prev))
  }

  const toggleDraftNiche = (n: Niche) => {
    if (!draft) return
    const cur = getKolNiches(draft)
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]
    const niches = next.length ? next : (['Multi'] as Niche[])
    setDraft({
      ...draft,
      niches,
      niche: niches[0],
    })
    setDirty(true)
  }

  const onAdd = () => {
    const k = createEmptyKol()
    const next = [k, ...kols]
    setKols(next)
    setSelectedId(k.id)
    setDraft(k)
    setDirty(true)
    goTab('edit')
    flash('Đã tạo KOL mới — nhớ Save')
  }

  const onDelete = () => {
    if (!draft) return
    if (!confirm(`Xóa @${draft.handle} khỏi store?`)) return
    const next = kols.filter((k) => k.id !== draft.id)
    void persistServer(next, 'admin delete')
    setSelectedId(null)
    setDraft(null)
    goTab('list')
  }

  const onResetSeed = () => {
    if (
      !confirm(
        'Load seed sheetKols.ts vào editor? Server R2 không đổi cho đến khi bấm Save all (R2).',
      )
    )
      return
    clearKolsStore()
    const seed = loadKols()
    setKols(seed)
    setSelectedId(null)
    setDraft(null)
    setDirty(true)
    setKolSource('seed')
    flash('Đã load seed — bấm Save (R2) nếu muốn publish')
  }

  const reloadKols = async () => {
    if (!confirmDiscardUnsaved(dirty)) return
    const { kols: list, source, updatedAt } = await loadKolsWithSource({
      includeHidden: true,
    })
    setKols(list)
    setKolSource(source)
    setKolUpdatedAt(updatedAt ?? null)
    setDirty(false)
    if (selectedId) {
      const sel = list.find((k) => k.id === selectedId)
      if (sel) setDraft(JSON.parse(JSON.stringify(sel)) as Kol)
    }
    flash(`Reloaded from ${source}`)
  }

  const saveKolsOps = () => {
    if (tab === 'edit' && draft) {
      onSaveDraft()
      return
    }
    void persistServer(kols, 'admin push all')
  }

  const onExport = () => {
    const blob = new Blob([exportKolsJson(kols)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vn-kol-admin-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Exported JSON')
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const list = importKolsJson(text)
      void persistServer(list, 'admin import')
      setSelectedId(null)
      setDraft(null)
      flash(`Imported ${list.length} KOLs — đang đẩy server…`)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const patchDraft = <K extends keyof Kol>(key: K, value: Kol[K]) => {
    if (!draft) return
    setDraft({ ...draft, [key]: value })
    setDirty(true)
  }

  /** Upload PDF/DOCX → R2 RadarKOLsReport/ → fill this KOL’s URL + publish */
  const onUploadSurfReport = async (file: File) => {
    if (!draft) {
      flash('Mở 1 KOL ở tab Edit rồi mới upload Surf PDF')
      return
    }
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      flash('Cần token — dán FEED_ADMIN_TOKEN ở thanh ops rồi upload')
      return
    }
    setAdminToken(token)
    setUploadingSurf(true)
    try {
      const filename = suggestSurfReportFilename(draft.handle, file.name)
      const result = await uploadSurfReport(file, { token, filename })
      if (!result.ok) {
        flash(`Upload thất bại: ${result.error}`)
        return
      }
      const nextDraft = {
        ...draft,
        surfReportPdfUrl: result.url,
      }
      setDraft(nextDraft)
      setDirty(true)
      const next = kols.some((k) => k.id === nextDraft.id)
        ? kols.map((k) => (k.id === nextDraft.id ? nextDraft : k))
        : [...kols, nextDraft]
      const ok = await persistServer(
        next,
        `admin surf upload @${nextDraft.handle}`,
      )
      if (ok) {
        flash(
          `Đã upload + publish Surf @${nextDraft.handle} → ${result.filename}`,
        )
      } else {
        flash(
          `Upload OK (${result.filename}) nhưng publish KOL list thất bại — bấm Save (R2)`,
        )
      }
    } finally {
      setUploadingSurf(false)
    }
  }

  const stats = useMemo(() => {
    const visible = kols.filter((k) => !k.hidden)
    return {
      total: kols.length,
      visible: visible.length,
      hidden: kols.length - visible.length,
      hot: visible.filter((k) => k.statusLabel === 'hot').length,
      aiBios: kols.filter((k) =>
        (k.bio || '').includes('Audience') || (k.bio || '').includes('AI'),
      ).length,
    }
  }, [kols])

  useRegisterAdminOps('kols', {
    dirty,
    saving: savingServer,
    source: kolSource,
    updatedAt: kolUpdatedAt ?? meta.updatedAt,
    save: saveKolsOps,
    reload: () => void reloadKols(),
  })

  const activeDataset = datasetForAdminTab(tab)
  const ops = useAdminOps(activeDataset)
  const opsUpdatedAt = ops?.updatedAt ?? (activeDataset === 'kols' ? kolUpdatedAt ?? meta.updatedAt : null)

  return (
    <div className="admin">
      <div className="admin-chrome">
      <div className="admin-ops">
        <a className="admin-ops__map" href="/">
          ← Map
        </a>
        <span className="admin-ops__file">
          {activeDataset ? DATASET_FILE[activeDataset] : '—'}
        </span>
        <span className="admin-ops__meta">
          {ops?.source || (activeDataset === 'kols' ? kolSource : '—')}
        </span>
        {opsUpdatedAt ? (
          <span className="admin-ops__meta">{formatTime(opsUpdatedAt)}</span>
        ) : null}
        {(ops?.dirty || (activeDataset === 'kols' && dirty)) && (
          <span className="admin-ops__dirty">unsaved</span>
        )}
        <label className="admin-ops__token">
          Token
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => {
              const v = e.target.value
              setTokenInput(v)
              setAdminToken(v)
            }}
            placeholder="FEED_ADMIN_TOKEN"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          disabled={
            !ops ||
            ops.saving ||
            !(ops.dirty || (activeDataset === 'kols' && dirty))
          }
          onClick={() => void ops?.save()}
        >
          {ops?.saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!ops}
          onClick={() => void ops?.reload()}
        >
          Reload
        </button>
      </div>

      <nav className="admin-nav" aria-label="Admin datasets">
        <div className="admin-nav__group">
          <span className="admin-nav__label">KOL</span>
          <button
            type="button"
            className={`admin-tab ${tab === 'list' || tab === 'edit' ? 'is-active' : ''}`}
            onClick={() => goTab('list')}
          >
            List
          </button>
        </div>
        <div className="admin-nav__group">
          <span className="admin-nav__label">Nội dung</span>
          {(
            [
              ['feed', 'Feed'],
              ['follows', 'Followers'],
              ['reports', 'Reports'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`admin-tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => goTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-nav__group">
          <span className="admin-nav__label">Chiến dịch</span>
          {(
            [
              ['banner', 'Banner'],
              ['scex', 'SCEX'],
              ['events', 'Events'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`admin-tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => goTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-nav__group">
          <span className="admin-nav__label">Tham chiếu</span>
          <button
            type="button"
            className={`admin-tab ${tab === 'data' ? 'is-active' : ''}`}
            onClick={() => goTab('data')}
          >
            TwitterScore
          </button>
          <button
            type="button"
            className={`admin-tab ${tab === 'legend' ? 'is-active' : ''}`}
            onClick={() => goTab('legend')}
          >
            Legend
          </button>
        </div>
      </nav>
      </div>

      {(tab === 'list' || tab === 'edit') && (
        <p className="admin-stats-line">
          {stats.visible} visible · {stats.hidden} hidden · {stats.hot} hot
          {stats.total !== stats.visible ? ` · ${stats.total} total` : ''}
        </p>
      )}

      {tab === 'feed' && (
        <AdminFeedEditor
          kols={kols}
          onToast={flash}
        />
      )}

      {tab === 'follows' && (
        <AdminRecentFollowersEditor kols={kols} onToast={flash} />
      )}

      {tab === 'data' && <AdminTwitterScoreEditor onToast={flash} />}

      {tab === 'scex' && <AdminScexEditor onToast={flash} />}

      {tab === 'banner' && <AdminBannerEditor onToast={flash} />}

      {tab === 'reports' && (
        <AdminKolReportsEditor onToast={flash} kols={kols} />
      )}

      {tab === 'events' && <AdminConvictionEventsEditor onToast={flash} />}

      {tab === 'legend' && <FieldLegend />}

      {tab === 'list' && (
        <div className="admin-list-wrap">
          <div className="admin-toolbar">
            <label className="admin-search-wrap">
              <span className="admin-search-wrap__icon" aria-hidden>
                ⌕
              </span>
              <input
                type="text"
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm @handle, tên, niche, rank, bio…"
                aria-label="Search KOL list"
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
            <select
              value={filterRank}
              onChange={(e) =>
                setFilterRank(
                  e.target.value === 'All'
                    ? 'All'
                    : (e.target.value as KolRank),
                )
              }
            >
              <option value="All">All ranks</option>
              {RANK_ORDER.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as StatusLabel | 'All')
              }
            >
              <option value="All">All status</option>
              {ADMIN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_EMOJI[s]} {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              Show hidden
            </label>
            <span className="admin-count">
              {filtered.length}
              {query.trim() ||
              filterRank !== 'All' ||
              filterStatus !== 'All' ||
              !showHidden
                ? ` / ${kols.length}`
                : ''}{' '}
              rows
            </span>
            <button type="button" className="btn" onClick={onAdd}>
              + Add KOL
            </button>
            <button type="button" className="btn" onClick={onExport}>
              Export
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
            <button type="button" className="btn btn--danger" onClick={onResetSeed}>
              Reset seed
            </button>
          </div>

          <div className="admin-table-scroll">
            {filtered.length === 0 ? (
              <div className="admin-empty admin-empty--filter">
                {query.trim()
                  ? `Không có KOL khớp “${query.trim()}”`
                  : 'Không có KOL khớp bộ lọc'}
                {(query.trim() ||
                  filterRank !== 'All' ||
                  filterStatus !== 'All' ||
                  !showHidden) && (
                  <button
                    type="button"
                    className="admin-empty__reset"
                    onClick={() => {
                      setQuery('')
                      setFilterRank('All')
                      setFilterStatus('All')
                      setShowHidden(true)
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Handle</th>
                    <th>Name</th>
                    <th>Rank</th>
                    <th>Status</th>
                    <th>Hidden</th>
                    <th>
                      Followers <SrcBadge source="x" />
                    </th>
                    <th>
                      Score <SrcBadge source="ai" />
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((k, i) => (
                    <tr
                      key={k.id}
                      className={selectedId === k.id ? 'is-selected' : ''}
                    >
                      <td>{i + 1}</td>
                      <td>
                        <strong>@{k.handle}</strong>
                      </td>
                      <td>{k.displayName}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="admin-table-inline"
                          value={getKolRank(k)}
                          onChange={(e) =>
                            patchKolInList(
                              k.id,
                              applyKolRank(k, e.target.value as KolRank),
                            )
                          }
                        >
                          {RANK_ORDER.map((r) => (
                            <option key={r} value={r}>
                              {RANK_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="admin-table-inline"
                          value={k.statusLabel ?? 'stable'}
                          onChange={(e) =>
                            patchKolInList(k.id, {
                              ...k,
                              statusLabel: e.target.value as StatusLabel,
                            })
                          }
                        >
                          {ADMIN_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_EMOJI[s]} {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!k.hidden}
                          onChange={(e) =>
                            patchKolInList(k.id, {
                              ...k,
                              hidden: e.target.checked,
                            })
                          }
                          aria-label={`Hidden @${k.handle}`}
                        />
                      </td>
                      <td>{fmt(k.followers)}</td>
                      <td>{k.score.toFixed(1)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => openKol(k.id)}
                        >
                          Form
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <div className="admin-edit-layout">
          <div className="admin-edit-side">
            <div className="admin-toolbar">
              <label className="admin-search-wrap">
                <span className="admin-search-wrap__icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="text"
                  className="admin-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm @handle, tên, niche…"
                  aria-label="Filter edit list"
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
            <div className="admin-side-list">
              {filtered.length === 0 ? (
                <div className="admin-empty admin-empty--side">
                  {query.trim()
                    ? 'Không khớp tìm kiếm'
                    : 'Không có KOL'}
                </div>
              ) : (
                filtered.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`admin-side-item ${selectedId === k.id ? 'is-active' : ''}`}
                    onClick={() => openKol(k.id)}
                  >
                    <AvatarImg
                      handle={k.handle}
                      name={k.displayName}
                      size={28}
                      color={NICHE_COLORS[primaryNiche(k)]}
                      avatarUrl={k.avatarUrl}
                    />
                    <span>
                      <strong>{k.displayName}</strong>
                      <small>@{k.handle}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="admin-editor">
            {!draft ? (
              <div className="admin-empty">Chọn KOL từ list hoặc Add KOL</div>
            ) : (
              <>
                <div className="admin-editor-head">
                  <div className="admin-editor-head__id">
                    <AvatarImg
                      handle={draft.handle}
                      name={draft.displayName}
                      size={48}
                      color={NICHE_COLORS[primaryNiche(draft)]}
                      avatarUrl={draft.avatarUrl}
                    />
                    <div>
                      <h2>
                        @{draft.handle}
                        {dirty && <span className="dirty"> · unsaved</span>}
                      </h2>
                      <p>{draft.displayName}</p>
                    </div>
                  </div>
                  <div className="admin-editor-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => goTab('list')}
                    >
                      ← List
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={savingServer || !dirty}
                      onClick={() => onSaveDraft()}
                      title="Lưu KOL này + đẩy list lên server (R2)"
                    >
                      {savingServer ? 'Saving…' : 'Save (R2)'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        if (!draft) return
                        const next = recalculateScores(draft)
                        setDraft(next)
                        setDirty(true)
                        flash('Recalculated score fields')
                      }}
                    >
                      Recalc scores
                    </button>
                    <button type="button" className="btn btn--danger" onClick={onDelete}>
                      Delete
                    </button>
                  </div>
                </div>

                <section className="admin-section">
                  <h3>
                    Identity <SrcBadge source="human" />
                  </h3>
                  <div className="admin-fields">
                    <Field label="Display name" source="human">
                      <input
                        value={draft.displayName}
                        onChange={(e) => patchDraft('displayName', e.target.value)}
                      />
                    </Field>
                    <Field label="Handle" source="human">
                      <input
                        value={draft.handle}
                        onChange={(e) => patchDraft('handle', e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Avatar R2 URL (override — để trống = /avatars/{handle}.jpg)"
                      source="human"
                    >
                      <div className="admin-avatar-field">
                        <AvatarImg
                          handle={draft.handle}
                          name={draft.displayName}
                          size={56}
                          color={NICHE_COLORS[primaryNiche(draft)]}
                          avatarUrl={draft.avatarUrl}
                        />
                        <div className="admin-avatar-field__controls">
                          <input
                            type="url"
                            value={draft.avatarUrl || ''}
                            onChange={(e) =>
                              patchDraft(
                                'avatarUrl',
                                normalizeAvatarUrl(e.target.value),
                              )
                            }
                            placeholder={xAvatarUrl(draft.handle)}
                            spellCheck={false}
                            autoComplete="off"
                          />
                          <div className="admin-avatar-field__actions">
                            <button
                              type="button"
                              className="btn btn--sm"
                              title="Điền URL R2 mặc định theo handle hiện tại"
                              onClick={() =>
                                patchDraft(
                                  'avatarUrl',
                                  xAvatarUrl(draft.handle),
                                )
                              }
                            >
                              Điền R2 mặc định
                            </button>
                            {draft.avatarUrl && (
                              <button
                                type="button"
                                className="btn btn--sm"
                                onClick={() =>
                                  patchDraft('avatarUrl', undefined)
                                }
                              >
                                Xóa override
                              </button>
                            )}
                            {draft.avatarUrl && (
                              <a
                                className="btn btn--sm"
                                href={draft.avatarUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Mở link
                              </a>
                            )}
                          </div>
                          <span className="admin-hint">
                            Dán public URL R2 (vd.{' '}
                            <code>
                              …/radar/avatars/
                              {draft.handle.replace(/^@/, '')}.jpg
                            </code>
                            ). Save → map/list dùng ảnh này ngay. File phải đã
                            upload lên R2 (script{' '}
                            <code>upload_avatar.mjs</code> hoặc PUT{' '}
                            <code>/api/avatar</code>).
                          </span>
                        </div>
                      </div>
                    </Field>
                    <Field
                      label="Rank (5 bậc — giống map)"
                      source="human"
                    >
                      <select
                        value={getKolRank(draft)}
                        onChange={(e) => {
                          const rank = e.target.value as KolRank
                          if (!draft) return
                          setDraft(applyKolRank(draft, rank))
                          setDirty(true)
                        }}
                      >
                        {RANK_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {RANK_LABELS[r]}
                            {r === 'challenger' || r === 'master'
                              ? ' · band 1'
                              : r === 'diamond' || r === 'platinum'
                                ? ' · band 2'
                                : ' · band 3'}
                          </option>
                        ))}
                      </select>
                      <div
                        className="muted"
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        Preview:
                        <RankBadge
                          rank={getKolRank(draft)}
                          tier={draft.tier}
                          score={draft.score}
                          isTop30={draft.isTop30}
                          size="sm"
                        />
                        <span>{formatRank(draft)}</span>
                        <span style={{ opacity: 0.85 }}>
                          · band T{draft.tier ?? tierForRank(getKolRank(draft))} · Save
                          (R2) khi xong
                        </span>
                      </div>
                    </Field>
                    <Field
                      label="Niches (multi — chọn nhiều hạng mục content)"
                      source="human"
                    >
                      <div className="admin-niche-multi">
                        {ADMIN_NICHES.map((n) => {
                          const on = getKolNiches(draft).includes(n)
                          return (
                            <label
                              key={n}
                              className={`admin-niche-chip ${on ? 'is-on' : ''}`}
                              style={
                                on
                                  ? {
                                      borderColor: `${NICHE_COLORS[n]}88`,
                                      color: NICHE_COLORS[n],
                                    }
                                  : undefined
                              }
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleDraftNiche(n)}
                              />
                              {n}
                            </label>
                          )
                        })}
                      </div>
                      <span className="admin-hint" style={{ margin: '6px 0 0' }}>
                        Primary (màu bubble) = hạng mục đầu:{' '}
                        <strong>{primaryNiche(draft)}</strong>
                      </span>
                    </Field>
                    <Field label="Type raw" source="human">
                      <input
                        value={draft.typeRaw ?? ''}
                        onChange={(e) => patchDraft('typeRaw', e.target.value)}
                      />
                    </Field>
                    <Field label="Hidden on map" source="human">
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={!!draft.hidden}
                          onChange={(e) => patchDraft('hidden', e.target.checked)}
                        />
                        Hidden
                      </label>
                    </Field>
                    <Field label="Status" source="ai">
                      <select
                        value={draft.statusLabel ?? 'stable'}
                        onChange={(e) =>
                          patchDraft('statusLabel', e.target.value as StatusLabel)
                        }
                      >
                        {ADMIN_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_EMOJI[s]} {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                <details className="admin-section admin-section--fold">
                  <summary>
                    <h3>
                      Assessment <SrcBadge source="ai" />
                    </h3>
                  </summary>
                  <Field
                    label="Bio / assessment chi tiết (AI: metrics + 7d + X bio + feed)"
                    source="ai"
                  >
                    <textarea
                      rows={12}
                      value={draft.bio}
                      onChange={(e) => patchDraft('bio', e.target.value)}
                      style={{ whiteSpace: 'pre-wrap', minHeight: 180 }}
                    />
                    <p className="admin-hint" style={{ marginTop: 8 }}>
                      Định dạng map: <code>**in đậm**</code>, bảng markdown (
                      <code>| cột | cột |</code> + dòng <code>|---|---|</code>
                      ), xuống dòng / bullet <code>•</code>.
                    </p>
                  </Field>
                </details>

                <details className="admin-section admin-section--fold">
                  <summary>
                    <h3>
                      Surf AI → KOL Report <SrcBadge source="ai" />
                    </h3>
                  </summary>
                  <p className="admin-hint" style={{ marginTop: 0 }}>
                    Map / tab “Phân tích sâu” mở <strong>KOL Report</strong>{' '}
                    (Markdown) trên web — không còn mở PDF. Soạn tại{' '}
                    <strong>★ KOL Reports</strong>, gắn handle map, set{' '}
                    <strong>Visibility = Public</strong>, Save R2.
                  </p>
                  <p className="admin-hint">
                    Handle hiện tại: <code>@{draft.handle}</code> — report
                    public cùng handle sẽ hiện badge “Report sẵn sàng” trên
                    Surf AI.
                  </p>
                  <details className="admin-legacy-pdf">
                    <summary>Legacy PDF (tùy chọn · không dùng trên map)</summary>
                    <Field
                      label="Surf report PDF (R2 · RadarKOLsReport/)"
                      source="ai"
                    >
                      <input
                        type="url"
                        value={draft.surfReportPdfUrl || ''}
                        onChange={(e) =>
                          patchDraft(
                            'surfReportPdfUrl',
                            e.target.value.trim() || undefined,
                          )
                        }
                        placeholder="https://pub-xxxx.r2.dev/RadarKOLsReport/….pdf"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </Field>
                    <div
                      className="admin-avatar-field__actions"
                      style={{ marginTop: 8 }}
                    >
                      <label
                        className={`btn btn--sm btn--file ${uploadingSurf ? 'is-disabled' : ''}`}
                      >
                        {uploadingSurf ? 'Uploading…' : 'Upload PDF → R2'}
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          hidden
                          disabled={uploadingSurf}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void onUploadSurfReport(f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {draft.surfReportPdfUrl ? (
                        <a
                          className="btn btn--sm"
                          href={draft.surfReportPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Test open
                        </a>
                      ) : null}
                    </div>
                  </details>
                </details>

                <details className="admin-section admin-section--fold">
                  <summary>
                    <h3>
                      X metrics <SrcBadge source="x" /> / scores <SrcBadge source="ai" />
                    </h3>
                  </summary>
                  <div className="admin-fields">
                    <Field label="Followers" source="x">
                      <input
                        type="number"
                        value={draft.followers}
                        onChange={(e) =>
                          patchDraft('followers', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Following" source="x">
                      <input
                        type="number"
                        value={draft.xFollowing ?? 0}
                        onChange={(e) =>
                          patchDraft('xFollowing', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Total tweets" source="x">
                      <input
                        type="number"
                        value={draft.tweetsTotal ?? 0}
                        onChange={(e) =>
                          patchDraft('tweetsTotal', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Posts/day (life)" source="derived">
                      <input
                        type="number"
                        step="0.01"
                        value={draft.tweetsPerDay ?? 0}
                        onChange={(e) =>
                          patchDraft('tweetsPerDay', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Quality proxy" source="ai">
                      <input
                        type="number"
                        value={draft.smartFollowers}
                        onChange={(e) =>
                          patchDraft('smartFollowers', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Verified" source="x">
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={!!draft.verified}
                          onChange={(e) => patchDraft('verified', e.target.checked)}
                        />
                        Verified
                      </label>
                    </Field>
                    <Field label="Activity level" source="ai">
                      <input
                        type="number"
                        value={draft.activityLevel ?? 0}
                        onChange={(e) =>
                          patchDraft('activityLevel', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Base score" source="ai">
                      <input
                        type="number"
                        step="0.1"
                        value={draft.baseScore}
                        onChange={(e) =>
                          patchDraft('baseScore', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Hot score" source="ai">
                      <input
                        type="number"
                        step="0.1"
                        value={draft.hotScore}
                        onChange={(e) =>
                          patchDraft('hotScore', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field label="Composite score" source="ai">
                      <input
                        type="number"
                        step="0.1"
                        value={draft.score}
                        onChange={(e) =>
                          patchDraft('score', Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                  </div>
                </details>

                <details className="admin-section admin-section--fold">
                  <summary>
                    <h3>
                      7d activity <SrcBadge source="sample" /> / <SrcBadge source="ai" />
                    </h3>
                  </summary>
                  <div className="admin-fields">
                    <Field label="7d posts" source="sample">
                      <input
                        type="number"
                        value={draft.activity7dPosts ?? ''}
                        onChange={(e) =>
                          patchDraft(
                            'activity7dPosts',
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="7d likes" source="sample">
                      <input
                        type="number"
                        value={draft.activity7dLikes ?? ''}
                        onChange={(e) =>
                          patchDraft(
                            'activity7dLikes',
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="7d views" source="sample">
                      <input
                        type="number"
                        value={draft.activity7dViews ?? ''}
                        onChange={(e) =>
                          patchDraft(
                            'activity7dViews',
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="7d score" source="ai">
                      <input
                        type="number"
                        step="0.1"
                        value={draft.activity7dScore ?? ''}
                        onChange={(e) =>
                          patchDraft(
                            'activity7dScore',
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="7d source" source="human">
                      <select
                        value={draft.activity7dSource ?? ''}
                        onChange={(e) =>
                          patchDraft(
                            'activity7dSource',
                            (e.target.value || undefined) as
                              | 'sampled'
                              | 'estimated'
                              | undefined,
                          )
                        }
                      >
                        <option value="">—</option>
                        <option value="sampled">sampled</option>
                        <option value="estimated">estimated</option>
                      </select>
                    </Field>
                    <Field label="Top 30 flag" source="derived">
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={!!draft.isTop30}
                          onChange={(e) => patchDraft('isTop30', e.target.checked)}
                        />
                        isTop30
                      </label>
                    </Field>
                  </div>
                </details>

                <p className="admin-hint">
                  <strong>Save (R2)</strong> = publish toàn list kèm KOL này lên{' '}
                  <code>kols/v1.json</code>. Website chỉ đọc R2 — cần token ở
                  thanh ops. Rank/status/hidden sửa trên bảng hoặc form đều
                  chung một lần Save.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="admin-toast glass">{toast}</div>}
    </div>
  )
}

function Field({
  label,
  source,
  children,
}: {
  label: string
  source: FieldSource
  children: ReactNode
}) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {label} <SrcBadge source={source} />
      </span>
      {children}
    </label>
  )
}

function SrcBadge({ source }: { source: FieldSource }) {
  const s = SOURCE_LABELS[source]
  return (
    <span className={`src src-${source}`} title={s.label}>
      {s.short}
    </span>
  )
}

function FieldLegend() {
  const groups = ['identity', 'metrics', 'scores', 'activity7d', 'flags'] as const
  return (
    <div className="admin-legend">
      <h2>Bảng nguồn field (AI vs X vs Human)</h2>
      <p className="admin-legend-intro">
        Dùng khi giải thích với client / team: phần nào do AI, phần nào ground truth.
      </p>
      <div className="admin-legend-badges">
        {(Object.keys(SOURCE_LABELS) as FieldSource[]).map((k) => (
          <span key={k} className={`src src-${k}`}>
            {SOURCE_LABELS[k].short} = {SOURCE_LABELS[k].label}
          </span>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g} className="admin-legend-group">
          <h3>{g}</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Source</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_META.filter((f) => f.group === g).map((f) => (
                <tr key={f.key}>
                  <td>
                    <code>{f.key}</code>
                    <div className="muted">{f.label}</div>
                  </td>
                  <td>
                    <SrcBadge source={f.source} />
                  </td>
                  <td>{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return iso
  }
}
