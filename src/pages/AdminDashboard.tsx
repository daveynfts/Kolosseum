import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Kol, KolRank, Niche, StatusLabel } from '../types'
import {
  applyKolRank,
  formatRank,
  getKolNiches,
  getKolRank,
  NICHE_COLORS,
  primaryNiche,
  formatStatus,
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
  suggestSurfReportFilename,
  uploadSurfReport,
} from '../lib/surfReportUpload'
import { AvatarImg } from '../components/AvatarImg'
import { AdminFeedEditor } from './AdminFeedEditor'
import { AdminRecentFollowersEditor } from './AdminRecentFollowersEditor'
import './AdminDashboard.css'

type Tab = 'list' | 'edit' | 'feed' | 'follows' | 'legend'

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  // #/admin/feed or #/admin?tab=feed
  if (h.includes('follows') || h.includes('followers')) return 'follows'
  if (h.includes('feed')) return 'feed'
  if (h.includes('legend')) return 'legend'
  if (h.includes('edit')) return 'edit'
  return 'list'
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
  const [feedAddSignal, setFeedAddSignal] = useState(0)
  const [kolSource, setKolSource] = useState<KolSource | 'loading'>('loading')
  const [savingServer, setSavingServer] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [uploadingSurf, setUploadingSurf] = useState(false)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Load shared R2 copy first so admin sees same data as everyone
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { kols: list, source } = await loadKolsWithSource()
      if (cancelled) return
      setKols(list)
      setKolSource(source)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goTab = (t: Tab) => {
    setTab(t)
    const path =
      t === 'feed'
        ? '#/admin/feed'
        : t === 'follows'
          ? '#/admin/follows'
          : t === 'legend'
            ? '#/admin/legend'
            : t === 'edit'
              ? '#/admin/edit'
              : '#/admin'
    if (window.location.hash !== path) {
      window.location.hash = path
    }
  }

  const meta = getStoreMeta()

  const selected = useMemo(
    () => kols.find((k) => k.id === selectedId) ?? null,
    [kols, selectedId],
  )

  useEffect(() => {
    if (selected) {
      setDraft(JSON.parse(JSON.stringify(selected)) as Kol)
      setTab('edit')
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

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
            'Chưa có token — dán FEED_ADMIN_TOKEN → Apply token → Save (R2). Website chỉ đọc R2.',
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
        setKols(next)
        setDirty(false)
        setKolSource('server')
        const withPdf = next.filter((k) => (k.surfReportPdfUrl || '').trim())
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
    setTab('edit')
    flash('Đã tạo KOL mới — nhớ Save')
  }

  const onDelete = () => {
    if (!draft) return
    if (!confirm(`Xóa @${draft.handle} khỏi store?`)) return
    const next = kols.filter((k) => k.id !== draft.id)
    void persistServer(next, 'admin delete')
    setSelectedId(null)
    setDraft(null)
    setTab('list')
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
    setDirty(false)
    setKolSource('seed')
    flash('Đã load seed — bấm Save all (R2) nếu muốn publish')
  }

  const onPushAllToServer = () => {
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
      flash('Cần token — dán FEED_ADMIN_TOKEN → Apply token rồi upload')
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

  return (
    <div className="admin">
      <header className="admin-top glass">
        <div className="admin-brand">
          <div>
            <h1>Admin Dashboard</h1>
            <p>
              Điều chỉnh KOL & bio · đồng bộ server (R2) cho mọi người · source:{' '}
              <strong>{kolSource}</strong>
            </p>
          </div>
        </div>
        <div className="admin-top-actions">
          <a className="btn" href="#/">
            ← Map
          </a>
          {tab === 'feed' ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setFeedAddSignal((n) => n + 1)}
            >
              + Add post
            </button>
          ) : (
            <button type="button" className="btn" onClick={onAdd}>
              + Add KOL
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => goTab('feed')}>
            X Feed
          </button>
          <button type="button" className="btn" onClick={() => goTab('follows')}>
            Smart Followers
          </button>
          {tab !== 'feed' && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={savingServer}
              onClick={onPushAllToServer}
              title="Đẩy toàn bộ list KOL lên R2 (mọi visitor thấy)"
            >
              {savingServer ? 'Saving…' : 'Save all (R2)'}
            </button>
          )}
          <button type="button" className="btn" onClick={onExport}>
            Export KOLs
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
      </header>

      <div className="admin-ai-banner glass">
        <strong>Đồng bộ server (R2)</strong>
        <span>
          Map public <em>chỉ</em> đọc <code>/api/kols</code> (R2). Đổi tier/bio
          xong phải <strong>Save</strong> (cần token). Source:{' '}
          <strong>{kolSource}</strong>
          {meta.updatedAt ? ` · ${meta.updatedAt.slice(0, 19)}` : ''}.
          {dirty ? ' · ⚠️ có thay đổi chưa publish' : ''}
        </span>
        <label className="admin-token-row">
          Token
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="FEED_ADMIN_TOKEN (bắt buộc để website thấy)"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setAdminToken(tokenInput)
            flash(
              tokenInput.trim()
                ? 'Đã apply token — giờ sửa KOL rồi bấm Save (R2)'
                : 'Đã xóa token',
            )
          }}
        >
          Apply token
        </button>
        <button type="button" className="btn" onClick={() => setTab('legend')}>
          Field legend
        </button>
      </div>

      <div className="admin-stats">
        <div className="admin-stat glass">
          <em>{stats.total}</em>
          <span>Total</span>
        </div>
        <div className="admin-stat glass">
          <em>{stats.visible}</em>
          <span>On map</span>
        </div>
        <div className="admin-stat glass">
          <em>{stats.hidden}</em>
          <span>Hidden</span>
        </div>
        <div className="admin-stat glass">
          <em>{stats.hot}</em>
          <span>Hot</span>
        </div>
        <div className="admin-stat glass">
          <em>{meta.updatedAt ? 'Local' : 'Seed'}</em>
          <span>{meta.updatedAt ? formatTime(meta.updatedAt) : 'sheetKols.ts'}</span>
        </div>
      </div>

      <div className="admin-tabs">
        {(['list', 'edit', 'feed', 'follows', 'legend'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tab ${tab === t ? 'is-active' : ''} ${t === 'feed' || t === 'follows' ? 'admin-tab--feed' : ''}`}
            onClick={() => goTab(t)}
          >
            {t === 'list'
              ? 'KOL list'
              : t === 'edit'
                ? 'Editor'
                : t === 'feed'
                  ? '★ X Feed'
                  : t === 'follows'
                    ? 'Smart Followers'
                    : 'AI field legend'}
          </button>
        ))}
      </div>

      {tab === 'feed' && (
        <AdminFeedEditor
          kols={kols}
          onToast={flash}
          addSignal={feedAddSignal}
        />
      )}

      {tab === 'follows' && (
        <AdminRecentFollowersEditor kols={kols} onToast={flash} />
      )}

      {tab === 'legend' && <FieldLegend />}

      {tab === 'list' && (
        <div className="admin-list-wrap glass">
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
              {query.trim() || filterRank !== 'All' || filterStatus !== 'All'
                ? ` / ${kols.length}`
                : ''}{' '}
              rows
            </span>
          </div>

          <div className="admin-table-scroll">
            {filtered.length === 0 ? (
              <div className="admin-empty admin-empty--filter">
                {query.trim()
                  ? `Không có KOL khớp “${query.trim()}”`
                  : 'Không có KOL khớp bộ lọc'}
                {(query.trim() ||
                  filterRank !== 'All' ||
                  filterStatus !== 'All') && (
                  <button
                    type="button"
                    className="admin-empty__reset"
                    onClick={() => {
                      setQuery('')
                      setFilterRank('All')
                      setFilterStatus('All')
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
                    <th></th>
                    <th>KOL</th>
                    <th>Rank</th>
                    <th>
                      Status <SrcBadge source="ai" />
                    </th>
                    <th>
                      Followers <SrcBadge source="x" />
                    </th>
                    <th>
                      Score <SrcBadge source="ai" />
                    </th>
                    <th>7d posts</th>
                    <th>Hidden</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((k) => (
                    <tr
                      key={k.id}
                      className={selectedId === k.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(k.id)}
                    >
                      <td>
                        <AvatarImg
                          handle={k.handle}
                          name={k.displayName}
                          size={32}
                          color={NICHE_COLORS[primaryNiche(k)]}
                          avatarUrl={k.avatarUrl}
                        />
                      </td>
                      <td>
                        <strong>{k.displayName}</strong>
                        <div className="muted">
                          @{k.handle}
                          {getKolNiches(k).length > 1
                            ? ` · ${getKolNiches(k).join(', ')}`
                            : ` · ${primaryNiche(k)}`}
                        </div>
                      </td>
                      <td>
                        <RankBadge
                          tier={k.tier}
                          score={k.score}
                          isTop30={k.isTop30}
                          rank={k.rank}
                          size="sm"
                        />
                        <span className="muted" style={{ marginLeft: 6 }}>
                          {formatRank(k)}
                        </span>
                      </td>
                      <td>
                        <span className="status-emoji-label">
                          {formatStatus(k.statusLabel)}
                        </span>
                      </td>
                      <td>{fmt(k.followers)}</td>
                      <td>{k.score.toFixed(1)}</td>
                      <td>
                        {k.activity7dPosts != null
                          ? `${k.activity7dPosts}${k.activity7dSource === 'sampled' ? '*' : '≈'}`
                          : '—'}
                      </td>
                      <td>{k.hidden ? 'yes' : ''}</td>
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
          <div className="admin-edit-side glass">
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
                    onClick={() => setSelectedId(k.id)}
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

          <div className="admin-editor glass">
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
                      className="btn btn--primary"
                      disabled={savingServer}
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
                          const nextDraft = applyKolRank(draft, rank)
                          setDraft(nextDraft)
                          setDirty(true)
                          // Publish immediately so map/R2 stay in sync
                          onSaveDraft(nextDraft)
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
                          · band T{draft.tier ?? tierForRank(getKolRank(draft))} ·
                          auto Save R2
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
                  </div>
                </section>

                <section className="admin-section">
                  <h3>
                    Assessment <SrcBadge source="ai" />
                  </h3>
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
                </section>

                <section className="admin-section">
                  <h3>
                    Surf AI report (mock) <SrcBadge source="ai" />
                  </h3>
                  <p className="admin-hint" style={{ marginTop: 0 }}>
                    Link PDF/DOCX public trên R2 cho <strong>KOL này</strong> —
                    user bấm logo Surf ở tab “Phân tích sâu”. Không có URL =
                    mock báo chưa cấu hình (không dùng default chung).
                  </p>
                  <Field
                    label="Surf report (R2 · RadarKOLsReport/)"
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
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                    <span className="admin-hint" style={{ margin: 0 }}>
                      Upload → tự điền URL + auto <strong>Save (R2)</strong>.
                      Prefix: <code>RadarKOLsReport/</code>
                    </span>
                  </div>
                </section>

                <section className="admin-section">
                  <h3>
                    X metrics <SrcBadge source="x" /> / scores <SrcBadge source="ai" />
                  </h3>
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
                </section>

                <section className="admin-section">
                  <h3>
                    7d activity <SrcBadge source="sample" /> / <SrcBadge source="ai" />
                  </h3>
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
                </section>

                <p className="admin-hint">
                  <strong>Save (R2)</strong> = publish toàn list kèm KOL này lên{' '}
                  <code>kols/v1.json</code>. <strong>Save all (R2)</strong> =
                  publish list hiện tại (header). Website chỉ đọc R2 — không có
                  chế độ lưu local-only. Cần token. Rank đổi sẽ auto-save nếu đã
                  có token.
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
    <div className="admin-legend glass">
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
