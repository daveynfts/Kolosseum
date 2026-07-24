/**
 * Admin: KOL evaluation reports (text corpus from DOCX).
 * AI-friendly storage + field changelog + private/public visibility.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  applyReportUpdate,
  createChangelogEntry,
  createEmptyReport,
  type KolReport,
  type KolReportsDataset,
} from '../data/kolReports'
import {
  clearKolReportsCache,
  exportKolReportsJson,
  importKolReportsJson,
  loadKolReportsWithSource,
  saveKolReportsToServer,
} from '../lib/kolReportsStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import { XProfileAvatar } from '../components/XProfileAvatar'

interface Props {
  onToast: (msg: string) => void
}

export function AdminKolReportsEditor({ onToast }: Props) {
  const [dataset, setDataset] = useState<KolReportsDataset | null>(null)
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [visFilter, setVisFilter] = useState<'all' | 'private' | 'public'>(
    'all',
  )

  useEffect(() => {
    let cancelled = false
    void loadKolReportsWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
      setSource(r.source)
      if (r.dataset.reports[0]) setSelectedId(r.dataset.reports[0].id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const list = useMemo(() => {
    if (!dataset) return [] as KolReport[]
    const base = showTrash ? dataset.trash || [] : dataset.reports
    let rows = base
    if (!showTrash && visFilter !== 'all') {
      rows = rows.filter((r) => r.visibility === visFilter)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.handle.includes(q) ||
          (r.displayName || '').toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q) ||
          (r.sourceFilename || '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [dataset, query, showTrash, visFilter])

  const selected = useMemo(() => {
    if (!dataset || !selectedId) return null
    return (
      dataset.reports.find((r) => r.id === selectedId) ||
      dataset.trash?.find((r) => r.id === selectedId) ||
      null
    )
  }, [dataset, selectedId])

  const patchSelected = (patch: Partial<KolReport>) => {
    if (!dataset || !selected || selected.deletedAt) return
    const next = applyReportUpdate(selected, patch, 'admin')
    setDataset({
      ...dataset,
      reports: dataset.reports.map((r) => (r.id === next.id ? next : r)),
      updatedAt: new Date().toISOString(),
    })
    setDirty(true)
  }

  const addReport = () => {
    if (!dataset) return
    const r = createEmptyReport()
    setDataset({
      ...dataset,
      reports: [r, ...dataset.reports],
      updatedAt: new Date().toISOString(),
    })
    setSelectedId(r.id)
    setDirty(true)
    onToast('Đã tạo báo cáo trống')
  }

  const softDelete = () => {
    if (!dataset || !selected || selected.deletedAt) return
    if (!confirm(`Xóa mềm báo cáo @${selected.handle}?`)) return
    const now = new Date().toISOString()
    const moved: KolReport = {
      ...selected,
      deletedAt: now,
      updatedAt: now,
      changelog: [
        createChangelogEntry('delete', `Soft-delete báo cáo @${selected.handle}`),
        ...(selected.changelog || []),
      ],
    }
    setDataset({
      ...dataset,
      reports: dataset.reports.filter((r) => r.id !== selected.id),
      trash: [moved, ...(dataset.trash || [])],
      updatedAt: now,
    })
    setSelectedId(null)
    setDirty(true)
    onToast('Đã chuyển vào trash')
  }

  const restore = () => {
    if (!dataset || !selected?.deletedAt) return
    const now = new Date().toISOString()
    const restored: KolReport = {
      ...selected,
      deletedAt: undefined,
      updatedAt: now,
      changelog: [
        createChangelogEntry('restore', `Khôi phục báo cáo @${selected.handle}`),
        ...(selected.changelog || []),
      ],
    }
    setDataset({
      ...dataset,
      reports: [restored, ...dataset.reports],
      trash: (dataset.trash || []).filter((r) => r.id !== selected.id),
      updatedAt: now,
    })
    setSelectedId(restored.id)
    setShowTrash(false)
    setDirty(true)
    onToast('Đã khôi phục')
  }

  const togglePublish = () => {
    if (!selected || selected.deletedAt) return
    const nextVis = selected.visibility === 'public' ? 'private' : 'public'
    patchSelected({ visibility: nextVis })
    onToast(nextVis === 'public' ? 'Đã set PUBLIC' : 'Đã set PRIVATE')
  }

  const save = async () => {
    if (!dataset) return
    setAdminToken(tokenInput)
    setSaving(true)
    const r = await saveKolReportsToServer(dataset, tokenInput)
    setSaving(false)
    if (r.ok) {
      setDirty(false)
      setSource('server')
      onToast('Đã lưu KOL reports lên R2')
    } else {
      onToast(`Lưu lỗi: ${r.status} ${r.message || ''}`)
    }
  }

  const reload = async () => {
    const r = await loadKolReportsWithSource(tokenInput)
    setDataset(r.dataset)
    setSource(r.source)
    setDirty(false)
    onToast(`Reload · source=${r.source}`)
  }

  if (!dataset) {
    return <p className="admin-muted">Đang tải reports…</p>
  }

  const pubCount = dataset.reports.filter((r) => r.visibility === 'public')
    .length

  return (
    <div className="admin-scex admin-kol-reports">
      <header className="admin-ts-head">
        <div>
          <h2>KOL Reports (text corpus)</h2>
          <p className="admin-muted">
            Báo cáo đánh giá dạng text · AI-friendly · changelog · private/public
            · source: <strong>{source}</strong>
            {dirty ? ' · unsaved' : ''} · {dataset.reports.length} reports ·{' '}
            {pubCount} public · trash {(dataset.trash || []).length}
          </p>
        </div>
        <div className="admin-ts-actions">
          <input
            className="admin-token-input"
            type="password"
            placeholder="FEED_ADMIN_TOKEN"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button type="button" className="admin-btn" onClick={() => void reload()}>
            Reload
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving || !dirty}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save R2'}
          </button>
        </div>
      </header>

      <div className="admin-ts-toolbar">
        <input
          className="admin-search"
          placeholder="Tìm handle, title, nội dung…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={visFilter}
          onChange={(e) =>
            setVisFilter(e.target.value as 'all' | 'private' | 'public')
          }
          disabled={showTrash}
        >
          <option value="all">All visibility</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <label className="admin-scex-check">
          <input
            type="checkbox"
            checked={showTrash}
            onChange={(e) => setShowTrash(e.target.checked)}
          />
          Trash
        </label>
        <button type="button" className="admin-btn" onClick={addReport}>
          + New report
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            const blob = new Blob([exportKolReportsJson(dataset)], {
              type: 'application/json',
            })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `kol-reports-${Date.now()}.json`
            a.click()
          }}
        >
          Export JSON
        </button>
        <label className="admin-btn" style={{ cursor: 'pointer' }}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const text = await f.text()
              const ds = importKolReportsJson(text)
              if (!ds) {
                onToast('JSON không hợp lệ')
                return
              }
              setDataset(ds)
              setDirty(true)
              onToast(`Import ${ds.reports.length} reports`)
            }}
          />
        </label>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            clearKolReportsCache()
            onToast('Đã xóa cache local')
          }}
        >
          Clear cache
        </button>
      </div>

      <div className="admin-ts-layout">
        <aside className="admin-ts-list glass">
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`admin-ts-list-item ${selectedId === r.id ? 'is-active' : ''}`}
              onClick={() => setSelectedId(r.id)}
            >
              <XProfileAvatar
                handle={r.handle}
                name={r.displayName || r.handle}
                size={28}
              />
              <span>
                <strong>@{r.handle}</strong>
                <small>
                  {r.visibility === 'public' ? 'PUBLIC' : 'private'}
                  {r.structured?.overallScore != null
                    ? ` · score ${r.structured.overallScore}`
                    : ''}{' '}
                  · {(r.text || '').length.toLocaleString()} chars
                  {r.sourceFilename ? ` · ${r.sourceFilename}` : ''}
                </small>
              </span>
            </button>
          ))}
          {!list.length && (
            <p className="admin-muted" style={{ padding: 12 }}>
              Không có report. Chạy import DOCX:
              <br />
              <code>node scripts/import_kol_reports_docx.mjs --put</code>
            </p>
          )}
        </aside>

        <main className="admin-ts-detail glass">
          {!selected ? (
            <p className="admin-muted">Chọn một report để xem / sửa.</p>
          ) : (
            <>
              <div className="admin-ts-detail__head">
                <XProfileAvatar
                  handle={selected.handle}
                  name={selected.displayName || selected.handle}
                  size={40}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{selected.title}</h3>
                  <p className="admin-muted" style={{ margin: '4px 0 0' }}>
                    @{selected.handle}
                    {selected.structured?.overallScore != null
                      ? ` · SurfAI score ${selected.structured.overallScore}/100`
                      : ''}{' '}
                    · updated {new Date(selected.updatedAt).toLocaleString()}
                    {selected.deletedAt ? ' · DELETED' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!selected.deletedAt && (
                    <>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={togglePublish}
                      >
                        {selected.visibility === 'public'
                          ? 'Set private'
                          : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={softDelete}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {selected.deletedAt && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={restore}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-ts-fields" style={{ marginTop: 12 }}>
                <label>
                  Handle
                  <input
                    value={selected.handle}
                    disabled={!!selected.deletedAt}
                    onChange={(e) =>
                      patchSelected({ handle: e.target.value })
                    }
                  />
                </label>
                <label>
                  Display name
                  <input
                    value={selected.displayName || ''}
                    disabled={!!selected.deletedAt}
                    onChange={(e) =>
                      patchSelected({ displayName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Title
                  <input
                    value={selected.title}
                    disabled={!!selected.deletedAt}
                    onChange={(e) => patchSelected({ title: e.target.value })}
                  />
                </label>
                <label>
                  Visibility
                  <select
                    value={selected.visibility}
                    disabled={!!selected.deletedAt}
                    onChange={(e) =>
                      patchSelected({
                        visibility:
                          e.target.value === 'public' ? 'public' : 'private',
                      })
                    }
                  >
                    <option value="private">private</option>
                    <option value="public">public</option>
                  </select>
                </label>
                <label>
                  Source file
                  <input
                    value={selected.sourceFilename || ''}
                    disabled={!!selected.deletedAt}
                    onChange={(e) =>
                      patchSelected({ sourceFilename: e.target.value })
                    }
                  />
                </label>
                <label>
                  Tags (comma)
                  <input
                    value={(selected.tags || []).join(', ')}
                    disabled={!!selected.deletedAt}
                    onChange={(e) =>
                      patchSelected({
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              </div>

              <label style={{ display: 'block', marginTop: 12 }}>
                <span className="admin-muted">
                  Report text (AI corpus · plain text)
                </span>
                <textarea
                  className="admin-bio-area"
                  rows={18}
                  disabled={!!selected.deletedAt}
                  value={selected.text}
                  onChange={(e) => patchSelected({ text: e.target.value })}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                />
              </label>

              <label style={{ display: 'block', marginTop: 12 }}>
                <span className="admin-muted">
                  Structured JSON (optional · metrics for scoring)
                </span>
                <textarea
                  className="admin-bio-area"
                  rows={8}
                  disabled={!!selected.deletedAt}
                  value={JSON.stringify(selected.structured || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const obj = JSON.parse(e.target.value || '{}')
                      patchSelected({ structured: obj })
                    } catch {
                      /* wait for valid JSON */
                    }
                  }}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                  }}
                />
              </label>

              <section style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 8px' }}>
                  Changelog ({(selected.changelog || []).length})
                </h4>
                <ul className="admin-kol-changelog">
                  {(selected.changelog || []).slice(0, 40).map((c) => (
                    <li key={c.id}>
                      <div className="admin-kol-changelog__meta">
                        <strong>{c.action}</strong>
                        <time dateTime={c.at}>
                          {new Date(c.at).toLocaleString()}
                        </time>
                        {c.by && <span>by {c.by}</span>}
                      </div>
                      <p>{c.summary}</p>
                      {c.changes?.length ? (
                        <ul className="admin-kol-changelog__diff">
                          {c.changes.map((ch, i) => (
                            <li key={i}>
                              <code>{ch.field}</code>
                              {ch.from != null && (
                                <span className="from">
                                  {String(ch.from).slice(0, 80)}
                                </span>
                              )}
                              {ch.to != null && (
                                <span className="to">
                                  → {String(ch.to).slice(0, 80)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
