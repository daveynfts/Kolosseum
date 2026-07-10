import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Kol, Niche, StatusLabel } from '../types'
import {
  getKolNiches,
  NICHE_COLORS,
  primaryNiche,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../types'
import {
  ADMIN_NICHES,
  ADMIN_STATUSES,
  clearKolsStore,
  createEmptyKol,
  exportKolsJson,
  getStoreMeta,
  importKolsJson,
  loadKols,
  recalculateScores,
  saveKols,
} from '../lib/kolStore'
import { FIELD_META, SOURCE_LABELS, type FieldSource } from '../lib/fieldMeta'
import { AvatarImg } from '../components/AvatarImg'
import { AdminFeedEditor } from './AdminFeedEditor'
import './AdminDashboard.css'

type Tab = 'list' | 'edit' | 'feed' | 'legend'

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  // #/admin/feed or #/admin?tab=feed
  if (h.includes('feed')) return 'feed'
  if (h.includes('legend')) return 'legend'
  if (h.includes('edit')) return 'edit'
  return 'list'
}

export function AdminDashboard() {
  const [kols, setKols] = useState<Kol[]>(() => loadKols())
  const [query, setQuery] = useState('')
  const [filterTier, setFilterTier] = useState<'All' | 1 | 2 | 3>('All')
  const [filterStatus, setFilterStatus] = useState<StatusLabel | 'All'>('All')
  const [showHidden, setShowHidden] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Kol | null>(null)
  const [tab, setTab] = useState<Tab>(() => tabFromHash())
  const [toast, setToast] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [feedAddSignal, setFeedAddSignal] = useState(0)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goTab = (t: Tab) => {
    setTab(t)
    const path =
      t === 'feed'
        ? '#/admin/feed'
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
        if (filterTier !== 'All' && k.tier !== filterTier) return false
        if (filterStatus !== 'All' && k.statusLabel !== filterStatus) return false
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          k.handle.toLowerCase().includes(q) ||
          k.displayName.toLowerCase().includes(q) ||
          (k.bio || '').toLowerCase().includes(q) ||
          (k.niche || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.score - a.score)
  }, [kols, query, filterTier, filterStatus, showHidden])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const persist = useCallback(
    (next: Kol[], note?: string) => {
      setKols(next)
      saveKols(next, note)
      setDirty(false)
      flash('Đã lưu vào localStorage')
    },
    [],
  )

  const onSaveDraft = () => {
    if (!draft) return
    const niches = getKolNiches(draft)
    const fixed = recalculateScores({
      ...draft,
      handle: draft.handle.replace(/^@/, '').trim(),
      niches,
      niche: niches[0] ?? 'Multi',
      dataSource: draft.dataSource === 'x-live' ? 'x-live+admin' : 'admin',
    })
    const next = kols.some((k) => k.id === fixed.id)
      ? kols.map((k) => (k.id === fixed.id ? fixed : k))
      : [...kols, fixed]
    persist(next, 'admin edit')
    setSelectedId(fixed.id)
    setDraft(fixed)
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
    persist(next, 'admin delete')
    setSelectedId(null)
    setDraft(null)
    setTab('list')
  }

  const onResetSeed = () => {
    if (
      !confirm(
        'Reset về seed sheetKols.ts (xóa chỉnh sửa localStorage)?',
      )
    )
      return
    clearKolsStore()
    const seed = loadKols()
    setKols(seed)
    setSelectedId(null)
    setDraft(null)
    setDirty(false)
    flash('Đã reset về seed')
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
      persist(list, 'admin import')
      setSelectedId(null)
      setDraft(null)
      flash(`Imported ${list.length} KOLs`)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const patchDraft = <K extends keyof Kol>(key: K, value: Kol[K]) => {
    if (!draft) return
    setDraft({ ...draft, [key]: value })
    setDirty(true)
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
              Điều chỉnh KOL & chỉ số · lưu localStorage · map đọc store này
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
            Tier 1 Feed
          </button>
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
        <strong>Ghi chú AI</strong>
        <span>
          Badge <em className="src src-ai">AI</em> = chỉ số / assessment do pipeline AI
          sinh (heuristic). <em className="src src-x">X</em> = profile X lúc sync.{' '}
          <em className="src src-human">Human</em> = sheet/admin.{' '}
          <em className="src src-sample">Sample</em> = sample post 7d (có thể capped).
          Admin override luôn được — bấm Save để map dùng giá trị của bạn.
        </span>
        <button type="button" className="btn" onClick={() => setTab('legend')}>
          Xem bảng nguồn field
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
        {(['list', 'edit', 'feed', 'legend'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tab ${tab === t ? 'is-active' : ''} ${t === 'feed' ? 'admin-tab--feed' : ''}`}
            onClick={() => goTab(t)}
          >
            {t === 'list'
              ? 'KOL list'
              : t === 'edit'
                ? 'Editor'
                : t === 'feed'
                  ? '★ Tier 1 Feed'
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

      {tab === 'legend' && <FieldLegend />}

      {tab === 'list' && (
        <div className="admin-list-wrap glass">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search handle, name, bio…"
            />
            <select
              value={String(filterTier)}
              onChange={(e) =>
                setFilterTier(
                  e.target.value === 'All'
                    ? 'All'
                    : (Number(e.target.value) as 1 | 2 | 3),
                )
              }
            >
              <option value="All">All tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
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
                  {STATUS_LABELS[s]}
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
            <span className="admin-count">{filtered.length} rows</span>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>KOL</th>
                  <th>Tier</th>
                  <th>Status <SrcBadge source="ai" /></th>
                  <th>Followers <SrcBadge source="x" /></th>
                  <th>Score <SrcBadge source="ai" /></th>
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
                    <td>T{k.tier}</td>
                    <td>
                      <span
                        style={{
                          color:
                            STATUS_COLORS[(k.statusLabel ?? 'stable') as StatusLabel],
                        }}
                      >
                        {k.statusLabel ?? '—'}
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
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <div className="admin-edit-layout">
          <div className="admin-edit-side glass">
            <div className="admin-toolbar">
              <input
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter list…"
              />
            </div>
            <div className="admin-side-list">
              {filtered.map((k) => (
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
                    color={NICHE_COLORS[k.niche]}
                  />
                  <span>
                    <strong>{k.displayName}</strong>
                    <small>@{k.handle}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-editor glass">
            {!draft ? (
              <div className="admin-empty">Chọn KOL từ list hoặc Add KOL</div>
            ) : (
              <>
                <div className="admin-editor-head">
                  <div>
                    <h2>
                      @{draft.handle}
                      {dirty && <span className="dirty"> · unsaved</span>}
                    </h2>
                    <p>{draft.displayName}</p>
                  </div>
                  <div className="admin-editor-actions">
                    <button type="button" className="btn" onClick={onSaveDraft}>
                      Save
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
                    <Field label="Tier" source="human">
                      <select
                        value={draft.tier ?? 2}
                        onChange={(e) =>
                          patchDraft('tier', Number(e.target.value) as 1 | 2 | 3)
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
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
                  </Field>
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
                            {STATUS_LABELS[s]}
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
                    <Field label="Δ vs sheet %" source="derived">
                      <input
                        type="number"
                        step="0.1"
                        value={draft.deltaPct}
                        onChange={(e) =>
                          patchDraft('deltaPct', Number(e.target.value) || 0)
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
                  Save ghi vào <code>localStorage</code> key{' '}
                  <code>vn-kol-map-admin-v1</code>. Map public đọc store này (ẩn KOL
                  có Hidden). Export JSON để backup / commit seed sau.
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
