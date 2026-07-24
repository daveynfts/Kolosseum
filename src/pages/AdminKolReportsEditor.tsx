/**
 * Admin: KOL evaluation reports — Markdown + images, changelog, private/public.
 * Manual authoring (no DOCX). Write / Preview / Split editor.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  applyReportUpdate,
  createChangelogEntry,
  createEmptyReport,
  type KolReport,
  type KolReportsDataset,
  type KolReportStructured,
} from '../data/kolReports'
import {
  clearKolReportsCache,
  exportKolReportsJson,
  importKolReportsJson,
  loadKolReportsWithSource,
  saveKolReportsToServer,
} from '../lib/kolReportsStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import {
  markdownImage,
  uploadKolReportImage,
} from '../lib/kolReportImageUpload'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { ReportMarkdown } from '../components/ReportMarkdown'

interface Props {
  onToast: (msg: string) => void
}

type ViewMode = 'write' | 'preview' | 'split'
type SidePanel = 'meta' | 'score' | 'log'

function cloneReport(r: KolReport): KolReport {
  return {
    ...r,
    structured: r.structured
      ? { ...r.structured, metrics: { ...(r.structured.metrics || {}) } }
      : {},
    tags: [...(r.tags || [])],
    changelog: [...(r.changelog || [])],
  }
}

function excerpt(text: string, n = 90): string {
  const t = (text || '')
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

export function AdminKolReportsEditor({ onToast }: Props) {
  const [dataset, setDataset] = useState<KolReportsDataset | null>(null)
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [visFilter, setVisFilter] = useState<'all' | 'private' | 'public'>(
    'all',
  )
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [sidePanel, setSidePanel] = useState<SidePanel>('meta')
  /** Local draft of selected report — changelog only on commit/save */
  const [draft, setDraft] = useState<KolReport | null>(null)
  const baselineRef = useRef<KolReport | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  // Sync draft when selection changes (flush previous dirty into dataset first if same session?)
  useEffect(() => {
    if (!dataset || !selectedId) {
      setDraft(null)
      baselineRef.current = null
      return
    }
    const r =
      dataset.reports.find((x) => x.id === selectedId) ||
      dataset.trash?.find((x) => x.id === selectedId) ||
      null
    if (!r) {
      setDraft(null)
      baselineRef.current = null
      return
    }
    const c = cloneReport(r)
    setDraft(c)
    baselineRef.current = cloneReport(r)
  }, [dataset, selectedId])

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
          (r.tags || []).some((t) => t.toLowerCase().includes(q)),
      )
    }
    return rows
  }, [dataset, query, showTrash, visFilter])

  const patchDraft = useCallback((patch: Partial<KolReport>) => {
    setDraft((prev) => {
      if (!prev || prev.deletedAt) return prev
      return { ...prev, ...patch }
    })
    setDirty(true)
  }, [])

  const patchStructured = useCallback((patch: Partial<KolReportStructured>) => {
    setDraft((prev) => {
      if (!prev || prev.deletedAt) return prev
      return {
        ...prev,
        structured: { ...(prev.structured || {}), ...patch },
      }
    })
    setDirty(true)
  }, [])

  /** Commit draft into dataset with changelog (relative to baseline) */
  const commitDraftToDataset = useCallback(
    (ds: KolReportsDataset, d: KolReport): KolReportsDataset => {
      const base = baselineRef.current
      if (!base || base.id !== d.id) {
        // new or unknown — replace as-is
        const isTrash = !!d.deletedAt
        if (isTrash) {
          return {
            ...ds,
            trash: (ds.trash || []).map((r) => (r.id === d.id ? d : r)),
            updatedAt: new Date().toISOString(),
          }
        }
        return {
          ...ds,
          reports: ds.reports.map((r) => (r.id === d.id ? d : r)),
          updatedAt: new Date().toISOString(),
        }
      }
      const next = applyReportUpdate(base, {
        handle: d.handle,
        displayName: d.displayName,
        title: d.title,
        text: d.text,
        visibility: d.visibility,
        coverImage: d.coverImage,
        notes: d.notes,
        tags: d.tags,
        structured: d.structured,
      })
      // Preserve fields applyReportUpdate may not copy
      next.coverImage = d.coverImage
      if (d.deletedAt) {
        return {
          ...ds,
          trash: (ds.trash || []).map((r) =>
            r.id === next.id ? { ...next, deletedAt: d.deletedAt } : r,
          ),
          updatedAt: new Date().toISOString(),
        }
      }
      return {
        ...ds,
        reports: ds.reports.map((r) => (r.id === next.id ? next : r)),
        updatedAt: new Date().toISOString(),
      }
    },
    [],
  )

  const addReport = () => {
    if (!dataset) return
    // commit current draft first
    let ds = dataset
    if (draft && dirty) {
      ds = commitDraftToDataset(ds, draft)
    }
    const r = createEmptyReport()
    ds = {
      ...ds,
      reports: [r, ...ds.reports],
      updatedAt: new Date().toISOString(),
    }
    setDataset(ds)
    setSelectedId(r.id)
    setDirty(true)
    setViewMode('write')
    onToast('Đã tạo báo cáo mới — chỉnh Markdown')
  }

  const softDelete = () => {
    if (!dataset || !draft || draft.deletedAt) return
    if (!confirm(`Xóa mềm báo cáo @${draft.handle}?`)) return
    const now = new Date().toISOString()
    const moved: KolReport = {
      ...draft,
      deletedAt: now,
      updatedAt: now,
      changelog: [
        createChangelogEntry('delete', `Soft-delete báo cáo @${draft.handle}`),
        ...(draft.changelog || []),
      ],
    }
    setDataset({
      ...dataset,
      reports: dataset.reports.filter((r) => r.id !== draft.id),
      trash: [moved, ...(dataset.trash || [])],
      updatedAt: now,
    })
    setSelectedId(null)
    setDirty(true)
    onToast('Đã chuyển vào trash')
  }

  const restore = () => {
    if (!dataset || !draft?.deletedAt) return
    const now = new Date().toISOString()
    const restored: KolReport = {
      ...draft,
      deletedAt: undefined,
      updatedAt: now,
      changelog: [
        createChangelogEntry('restore', `Khôi phục báo cáo @${draft.handle}`),
        ...(draft.changelog || []),
      ],
    }
    setDataset({
      ...dataset,
      reports: [restored, ...dataset.reports],
      trash: (dataset.trash || []).filter((r) => r.id !== draft.id),
      updatedAt: now,
    })
    setSelectedId(restored.id)
    setShowTrash(false)
    setDirty(true)
    onToast('Đã khôi phục')
  }

  const togglePublish = () => {
    if (!draft || draft.deletedAt) return
    const nextVis = draft.visibility === 'public' ? 'private' : 'public'
    patchDraft({ visibility: nextVis })
    onToast(nextVis === 'public' ? 'Đã set PUBLIC' : 'Đã set PRIVATE')
  }

  const save = async () => {
    if (!dataset) return
    setAdminToken(tokenInput)
    let ds = dataset
    if (draft) {
      ds = commitDraftToDataset(ds, draft)
      setDataset(ds)
      baselineRef.current = cloneReport(
        ds.reports.find((r) => r.id === draft.id) ||
          ds.trash?.find((r) => r.id === draft.id) ||
          draft,
      )
      // refresh draft with committed changelog
      const committed =
        ds.reports.find((r) => r.id === draft.id) ||
        ds.trash?.find((r) => r.id === draft.id)
      if (committed) setDraft(cloneReport(committed))
    }
    setSaving(true)
    const r = await saveKolReportsToServer(ds, tokenInput)
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
    if (dirty && !confirm('Có thay đổi chưa lưu. Reload và bỏ?')) return
    const r = await loadKolReportsWithSource(tokenInput)
    setDataset(r.dataset)
    setSource(r.source)
    setDirty(false)
    onToast(`Reload · source=${r.source}`)
  }

  const insertAtCursor = (snippet: string, selectPlaceholder?: string) => {
    const el = textareaRef.current
    if (!draft) return
    if (!el) {
      patchDraft({ text: `${draft.text}\n${snippet}` })
      return
    }
    const start = el.selectionStart ?? draft.text.length
    const end = el.selectionEnd ?? start
    const before = draft.text.slice(0, start)
    const after = draft.text.slice(end)
    const next = `${before}${snippet}${after}`
    patchDraft({ text: next })
    requestAnimationFrame(() => {
      el.focus()
      if (selectPlaceholder && snippet.includes(selectPlaceholder)) {
        const i = before.length + snippet.indexOf(selectPlaceholder)
        el.setSelectionRange(i, i + selectPlaceholder.length)
      } else {
        const pos = before.length + snippet.length
        el.setSelectionRange(pos, pos)
      }
    })
  }

  const wrapSelection = (left: string, right: string, fallback: string) => {
    const el = textareaRef.current
    if (!draft || !el) {
      insertAtCursor(`${left}${fallback}${right}`, fallback)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = draft.text.slice(start, end)
    const inner = selected || fallback
    const snippet = `${left}${inner}${right}`
    const before = draft.text.slice(0, start)
    const after = draft.text.slice(end)
    patchDraft({ text: `${before}${snippet}${after}` })
    requestAnimationFrame(() => {
      el.focus()
      if (!selected) {
        const i = before.length + left.length
        el.setSelectionRange(i, i + inner.length)
      } else {
        const pos = before.length + snippet.length
        el.setSelectionRange(pos, pos)
      }
    })
  }

  const onMdKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      wrapSelection('**', '**', 'đậm')
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault()
      wrapSelection('*', '*', 'nghiêng')
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void save()
    }
  }

  const insertImageUrl = () => {
    const url = window.prompt('URL ảnh (https://… hoặc /r2/…)')
    if (!url?.trim()) return
    const alt = window.prompt('Mô tả ảnh (alt)', 'image') || 'image'
    insertAtCursor(`\n${markdownImage(url.trim(), alt)}\n\n`)
  }

  const onUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAdminToken(tokenInput)
    setUploading(true)
    const r = await uploadKolReportImage(file, { token: tokenInput })
    setUploading(false)
    if (!r.ok) {
      onToast(`Upload ảnh lỗi: ${r.error}`)
      return
    }
    const alt = file.name.replace(/\.[^.]+$/, '') || 'image'
    insertAtCursor(`\n${markdownImage(r.url, alt)}\n\n`)
    onToast(`Đã chèn ảnh · ${r.bytes} bytes`)
  }

  const setCoverFromUrl = () => {
    const url = window.prompt(
      'Cover image URL',
      draft?.coverImage || '',
    )
    if (url == null) return
    patchDraft({ coverImage: url.trim() })
  }

  const onCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAdminToken(tokenInput)
    setUploading(true)
    const r = await uploadKolReportImage(file, {
      token: tokenInput,
      filename: `cover_${draft?.handle || 'kol'}_${Date.now().toString(36)}.${
        file.name.split('.').pop() || 'jpg'
      }`,
    })
    setUploading(false)
    if (!r.ok) {
      onToast(`Upload cover lỗi: ${r.error}`)
      return
    }
    patchDraft({ coverImage: r.url })
    onToast('Đã set cover image')
  }

  if (!dataset) {
    return (
      <div className="admin-kol-reports">
        <p className="admin-muted">Đang tải reports…</p>
      </div>
    )
  }

  const pubCount = dataset.reports.filter((r) => r.visibility === 'public')
    .length
  const score = draft?.structured?.overallScore
  const readOnly = !!draft?.deletedAt

  return (
    <div className="admin-kol-reports">
      <header className="akr-head">
        <div className="akr-head__title">
          <h2>KOL Reports</h2>
          <p className="admin-muted">
            Markdown · ảnh · changelog · private/public
            <span className="akr-pill">{source}</span>
            {dirty ? <span className="akr-pill akr-pill--warn">unsaved</span> : null}
            <span className="akr-pill">
              {dataset.reports.length} reports
            </span>
            <span className="akr-pill akr-pill--pub">{pubCount} public</span>
            {(dataset.trash || []).length > 0 ? (
              <span className="akr-pill">
                trash {(dataset.trash || []).length}
              </span>
            ) : null}
          </p>
        </div>
        <div className="akr-head__actions">
          <input
            className="admin-token-input"
            type="password"
            placeholder="FEED_ADMIN_TOKEN"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoComplete="off"
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

      <div className="akr-toolbar">
        <div className="akr-search-wrap">
          <input
            className="admin-search"
            placeholder="Tìm handle, title, tag, nội dung…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="akr-seg">
          {(['all', 'private', 'public'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`akr-seg__btn ${visFilter === v && !showTrash ? 'is-active' : ''}`}
              disabled={showTrash}
              onClick={() => {
                setShowTrash(false)
                setVisFilter(v)
              }}
            >
              {v === 'all' ? 'All' : v === 'private' ? 'Private' : 'Public'}
            </button>
          ))}
          <button
            type="button"
            className={`akr-seg__btn ${showTrash ? 'is-active' : ''}`}
            onClick={() => setShowTrash((x) => !x)}
          >
            Trash
          </button>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={addReport}>
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
          Export
        </button>
        <label className="admin-btn akr-file-btn">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
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

      <div className="akr-layout">
        <aside className="akr-list glass">
          {list.map((r) => {
            const active = selectedId === r.id
            const sc = r.structured?.overallScore
            return (
              <button
                key={r.id}
                type="button"
                className={`akr-card ${active ? 'is-active' : ''} ${r.visibility === 'public' ? 'is-public' : ''}`}
                onClick={() => {
                  if (draft && dirty && draft.id !== r.id && dataset) {
                    // auto-commit previous draft into memory
                    setDataset(commitDraftToDataset(dataset, draft))
                  }
                  setSelectedId(r.id)
                }}
              >
                {r.coverImage ? (
                  <span
                    className="akr-card__cover"
                    style={{ backgroundImage: `url(${r.coverImage})` }}
                  />
                ) : (
                  <span className="akr-card__avatar">
                    <XProfileAvatar
                      handle={r.handle}
                      name={r.displayName || r.handle}
                      size={36}
                    />
                  </span>
                )}
                <span className="akr-card__body">
                  <span className="akr-card__row">
                    <strong>@{r.handle}</strong>
                    <span
                      className={`akr-badge ${r.visibility === 'public' ? 'akr-badge--pub' : ''}`}
                    >
                      {r.visibility === 'public' ? 'PUBLIC' : 'private'}
                    </span>
                  </span>
                  <span className="akr-card__title">{r.title}</span>
                  <span className="akr-card__excerpt">{excerpt(r.text)}</span>
                  <span className="akr-card__meta">
                    {sc != null ? <em>score {sc}</em> : null}
                    <span>{(r.text || '').length.toLocaleString()} chars</span>
                  </span>
                </span>
              </button>
            )
          })}
          {!list.length && (
            <div className="akr-empty">
              <p>Chưa có report{showTrash ? ' trong trash' : ''}.</p>
              {!showTrash && (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={addReport}
                >
                  Tạo báo cáo Markdown
                </button>
              )}
            </div>
          )}
        </aside>

        <main className="akr-detail glass">
          {!draft ? (
            <div className="akr-empty akr-empty--center">
              <p>Chọn một report ở danh sách, hoặc tạo mới.</p>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={addReport}
              >
                + New report
              </button>
            </div>
          ) : (
            <>
              {draft.coverImage ? (
                <div
                  className="akr-hero"
                  style={{ backgroundImage: `url(${draft.coverImage})` }}
                >
                  <div className="akr-hero__fade" />
                </div>
              ) : null}

              <div className="akr-detail__head">
                <XProfileAvatar
                  handle={draft.handle}
                  name={draft.displayName || draft.handle}
                  size={44}
                />
                <div className="akr-detail__titles">
                  <input
                    className="akr-title-input"
                    value={draft.title}
                    disabled={readOnly}
                    onChange={(e) => patchDraft({ title: e.target.value })}
                    placeholder="Tiêu đề báo cáo"
                  />
                  <div className="akr-detail__sub">
                    <span>@{draft.handle}</span>
                    {score != null ? (
                      <span className="akr-score-chip">{score}/100</span>
                    ) : null}
                    <span
                      className={`akr-badge ${draft.visibility === 'public' ? 'akr-badge--pub' : ''}`}
                    >
                      {draft.visibility}
                    </span>
                    <time dateTime={draft.updatedAt}>
                      {new Date(draft.updatedAt).toLocaleString()}
                    </time>
                    {draft.deletedAt ? (
                      <span className="akr-badge akr-badge--danger">DELETED</span>
                    ) : null}
                  </div>
                </div>
                <div className="akr-detail__actions">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        className={`admin-btn ${draft.visibility === 'public' ? '' : 'admin-btn--primary'}`}
                        onClick={togglePublish}
                      >
                        {draft.visibility === 'public'
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
                  {readOnly && (
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

              <div className="akr-editor-chrome">
                <div className="akr-seg akr-seg--sm">
                  {(
                    [
                      ['write', 'Write'],
                      ['split', 'Split'],
                      ['preview', 'Preview'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`akr-seg__btn ${viewMode === k ? 'is-active' : ''}`}
                      onClick={() => setViewMode(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {!readOnly && viewMode !== 'preview' ? (
                  <div className="akr-md-tools">
                    <button
                      type="button"
                      title="Heading"
                      onClick={() => insertAtCursor('\n## ', '')}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      title="Bold (Ctrl+B)"
                      onClick={() => wrapSelection('**', '**', 'đậm')}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      title="Italic (Ctrl+I)"
                      onClick={() => wrapSelection('*', '*', 'nghiêng')}
                    >
                      I
                    </button>
                    <button
                      type="button"
                      title="Bullet list"
                      onClick={() => insertAtCursor('\n- item\n', 'item')}
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      title="Quote"
                      onClick={() => insertAtCursor('\n> ', '')}
                    >
                      Quote
                    </button>
                    <button
                      type="button"
                      title="Table"
                      onClick={() =>
                        insertAtCursor(
                          '\n| Cột | Giá trị |\n| --- | --- |\n| A | 1 |\n\n',
                        )
                      }
                    >
                      Table
                    </button>
                    <button
                      type="button"
                      title="Link"
                      onClick={() =>
                        wrapSelection('[', '](https://)', 'link')
                      }
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      title="Image URL"
                      onClick={insertImageUrl}
                    >
                      🖼 URL
                    </button>
                    <button
                      type="button"
                      title="Upload image to R2"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? '…' : '⬆ Ảnh'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                      hidden
                      onChange={(e) => void onUploadImage(e)}
                    />
                    <button
                      type="button"
                      title="Horizontal rule"
                      onClick={() => insertAtCursor('\n\n---\n\n')}
                    >
                      ―
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                className={`akr-editor ${
                  viewMode === 'split'
                    ? 'akr-editor--split'
                    : viewMode === 'preview'
                      ? 'akr-editor--preview'
                      : 'akr-editor--write'
                }`}
              >
                {viewMode !== 'preview' && (
                  <div className="akr-write">
                    <textarea
                      ref={textareaRef}
                      className="akr-textarea"
                      disabled={readOnly}
                      value={draft.text}
                      onChange={(e) => patchDraft({ text: e.target.value })}
                      onKeyDown={onMdKeyDown}
                      spellCheck={false}
                      placeholder="# Tiêu đề&#10;&#10;Viết Markdown…&#10;&#10;![ảnh](https://…)"
                    />
                    <div className="akr-write__hint">
                      Markdown · Ctrl+B đậm · Ctrl+I nghiêng · Ctrl+S lưu ·{' '}
                      {(draft.text || '').length.toLocaleString()} chars
                    </div>
                  </div>
                )}
                {viewMode !== 'write' && (
                  <div className="akr-preview">
                    <ReportMarkdown text={draft.text} />
                  </div>
                )}
              </div>

              <div className="akr-side-tabs">
                {(
                  [
                    ['meta', 'Meta'],
                    ['score', 'Score / AI'],
                    ['log', `Changelog (${(draft.changelog || []).length})`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`akr-side-tabs__btn ${sidePanel === k ? 'is-active' : ''}`}
                    onClick={() => setSidePanel(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sidePanel === 'meta' && (
                <div className="akr-panel">
                  <div className="admin-ts-fields">
                    <label>
                      Handle
                      <input
                        value={draft.handle}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchDraft({ handle: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Display name
                      <input
                        value={draft.displayName || ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchDraft({ displayName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Visibility
                      <select
                        value={draft.visibility}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchDraft({
                            visibility:
                              e.target.value === 'public'
                                ? 'public'
                                : 'private',
                          })
                        }
                      >
                        <option value="private">private</option>
                        <option value="public">public</option>
                      </select>
                    </label>
                    <label>
                      Tags (comma)
                      <input
                        value={(draft.tags || []).join(', ')}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchDraft({
                            tags: e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label className="admin-ts-fields--full">
                      Cover image URL
                      <div className="akr-cover-row">
                        <input
                          value={draft.coverImage || ''}
                          disabled={readOnly}
                          placeholder="https://… hoặc upload"
                          onChange={(e) =>
                            patchDraft({ coverImage: e.target.value })
                          }
                        />
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={setCoverFromUrl}
                            >
                              Paste
                            </button>
                            <label className="admin-btn akr-file-btn">
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => void onCoverUpload(e)}
                              />
                            </label>
                          </>
                        )}
                      </div>
                      {draft.coverImage ? (
                        <img
                          src={draft.coverImage}
                          alt="cover preview"
                          className="akr-cover-thumb"
                        />
                      ) : null}
                    </label>
                    <label className="admin-ts-fields--full">
                      Notes (internal)
                      <textarea
                        rows={2}
                        disabled={readOnly}
                        value={draft.notes || ''}
                        onChange={(e) =>
                          patchDraft({ notes: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {sidePanel === 'score' && (
                <div className="akr-panel">
                  <p className="admin-muted akr-panel__lead">
                    Trường cấu trúc cho AI scoring sau này — text Markdown vẫn
                    là source of truth.
                  </p>
                  <div className="admin-ts-fields">
                    <label>
                      Overall score (0–100)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={readOnly}
                        value={
                          draft.structured?.overallScore != null
                            ? String(draft.structured.overallScore)
                            : ''
                        }
                        onChange={(e) => {
                          const v = e.target.value
                          patchStructured({
                            overallScore:
                              v === '' ? null : Number(v),
                          })
                        }}
                      />
                    </label>
                    <label>
                      Tier hint
                      <input
                        disabled={readOnly}
                        value={draft.structured?.tierHint || ''}
                        onChange={(e) =>
                          patchStructured({ tierHint: e.target.value })
                        }
                        placeholder="challenger / master / …"
                      />
                    </label>
                    <label className="admin-ts-fields--full">
                      Niches (comma)
                      <input
                        disabled={readOnly}
                        value={(draft.structured?.niches || []).join(', ')}
                        onChange={(e) =>
                          patchStructured({
                            niches: e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="airdrop, defi, builder…"
                      />
                    </label>
                    <label className="admin-ts-fields--full">
                      Strengths (mỗi dòng 1 ý)
                      <textarea
                        rows={3}
                        disabled={readOnly}
                        value={(draft.structured?.strengths || []).join('\n')}
                        onChange={(e) =>
                          patchStructured({
                            strengths: e.target.value
                              .split('\n')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label className="admin-ts-fields--full">
                      Risks
                      <textarea
                        rows={3}
                        disabled={readOnly}
                        value={(draft.structured?.risks || []).join('\n')}
                        onChange={(e) =>
                          patchStructured({
                            risks: e.target.value
                              .split('\n')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label className="admin-ts-fields--full">
                      Structured JSON (advanced)
                      <textarea
                        className="akr-json"
                        rows={6}
                        disabled={readOnly}
                        value={JSON.stringify(
                          draft.structured || {},
                          null,
                          2,
                        )}
                        onChange={(e) => {
                          try {
                            const obj = JSON.parse(
                              e.target.value || '{}',
                            ) as KolReportStructured
                            patchDraft({ structured: obj })
                          } catch {
                            /* wait */
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {sidePanel === 'log' && (
                <div className="akr-panel">
                  <ul className="admin-kol-changelog">
                    {(draft.changelog || []).slice(0, 50).map((c) => (
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
                    {!(draft.changelog || []).length && (
                      <li>
                        <p className="admin-muted">Chưa có lịch sử.</p>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
