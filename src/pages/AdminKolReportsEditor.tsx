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
  type ClipboardEvent,
  type DragEvent,
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
  fileFromClipboardItem,
  isImageFile,
  markdownImage,
  uploadKolReportImage,
} from '../lib/kolReportImageUpload'
import {
  htmlToMarkdown,
  shouldConvertHtmlPaste,
} from '../lib/htmlToMarkdown'
import {
  REPORT_TEMPLATES,
  type ReportTemplateId,
} from '../lib/reportTemplates'
import { docxFileToReportMarkdown } from '../lib/docxToReportMarkdown'
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
  const [uploadLabel, setUploadLabel] = useState('')
  const [dragOver, setDragOver] = useState(false)
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
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const docxInputRef = useRef<HTMLInputElement | null>(null)
  const [importingDocx, setImportingDocx] = useState(false)

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
    // Enter: continue markdown lists automatically
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const el = textareaRef.current
      if (!el || !draft) return
      const pos = el.selectionStart
      const before = draft.text.slice(0, pos)
      const lineStart = before.lastIndexOf('\n') + 1
      const line = before.slice(lineStart)
      const ul = line.match(/^(\s*)([-*+])\s+(.*)$/)
      const ol = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/)
      if (ul) {
        e.preventDefault()
        if (!ul[3].trim()) {
          // empty bullet → exit list
          const next =
            draft.text.slice(0, lineStart) + draft.text.slice(pos)
          patchDraft({ text: next })
          requestAnimationFrame(() => {
            el.focus()
            el.setSelectionRange(lineStart, lineStart)
          })
          return
        }
        const insert = `\n${ul[1]}${ul[2]} `
        insertAtCursor(insert)
        return
      }
      if (ol) {
        e.preventDefault()
        if (!ol[3].trim()) {
          const next =
            draft.text.slice(0, lineStart) + draft.text.slice(pos)
          patchDraft({ text: next })
          requestAnimationFrame(() => {
            el.focus()
            el.setSelectionRange(lineStart, lineStart)
          })
          return
        }
        const n = Number(ol[2]) + 1
        insertAtCursor(`\n${ol[1]}${n}. `)
      }
    }
  }

  const applyTemplate = (id: ReportTemplateId) => {
    if (!draft || draft.deletedAt) return
    const tpl = REPORT_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    const body = tpl.build(draft.handle, draft.displayName)
    if ((draft.text || '').trim().length > 40) {
      if (
        !confirm(
          'Thay toàn bộ nội dung hiện tại bằng template? (không hoàn tác trừ khi Reload)',
        )
      ) {
        return
      }
    }
    patchDraft({ text: body })
    setViewMode('split')
    onToast(`Đã áp template: ${tpl.label}`)
  }

  /**
   * Single path for every image: File → PUT /api/kol-report-image → R2.
   * Markdown only stores the returned public URL (never base64/blob).
   */
  const uploadFileToR2 = useCallback(
    async (
      file: File,
      mode: 'inline' | 'cover',
    ): Promise<{ url: string; key: string } | null> => {
      if (!isImageFile(file)) {
        onToast('Chỉ PNG / JPEG / WebP / GIF — upload thẳng R2')
        return null
      }
      if (!tokenInput.trim()) {
        onToast('Dán FEED_ADMIN_TOKEN trước khi upload ảnh lên R2')
        return null
      }
      setAdminToken(tokenInput)
      setUploading(true)
      setUploadLabel(file.name || 'image')
      const r = await uploadKolReportImage(file, {
        token: tokenInput,
        handle:
          mode === 'cover'
            ? `cover_${draft?.handle || 'kol'}`
            : draft?.handle,
      })
      setUploading(false)
      setUploadLabel('')
      if (!r.ok) {
        onToast(`R2 upload lỗi: ${r.error}`)
        return null
      }
      if (r.storage !== 'r2') {
        onToast('Upload không xác nhận storage=r2')
        return null
      }
      return { url: r.url, key: r.key }
    },
    [tokenInput, draft?.handle, onToast],
  )

  const insertImageFromR2 = async (file: File) => {
    if (draft?.deletedAt) return
    const up = await uploadFileToR2(file, 'inline')
    if (!up) return
    const alt = file.name.replace(/\.[^.]+$/, '') || 'image'
    insertAtCursor(`\n${markdownImage(up.url, alt)}\n\n`)
    setDraft((prev) => {
      if (!prev) return prev
      const metrics = { ...(prev.structured?.metrics || {}) }
      const prevRaw = String(metrics.r2ImageUrls || '')
      const prevList = prevRaw
        ? prevRaw.split('\n').map((s) => s.trim()).filter(Boolean)
        : []
      metrics.r2ImageUrls = [...prevList, up.url].slice(-40).join('\n')
      metrics.lastR2Key = up.key
      return {
        ...prev,
        structured: { ...(prev.structured || {}), metrics },
      }
    })
    setDirty(true)
    onToast(`Đã lưu R2 · ${up.key}`)
  }

  const insertImageUrl = () => {
    const url = window.prompt(
      'Chỉ dùng cho ảnh đã public (CDN). Muốn lưu R2: dùng nút ⬆ Ảnh / kéo thả / paste.',
    )
    if (!url?.trim()) return
    const alt = window.prompt('Mô tả ảnh (alt)', 'image') || 'image'
    insertAtCursor(`\n${markdownImage(url.trim(), alt)}\n\n`)
  }

  const setCoverFromUrl = () => {
    const url = window.prompt(
      'Cover URL (public). Để lưu R2 hãy Upload cover.',
      draft?.coverImage || '',
    )
    if (url == null) return
    patchDraft({ coverImage: url.trim() })
  }

  const onCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const up = await uploadFileToR2(file, 'cover')
    if (!up) return
    patchDraft({ coverImage: up.url })
    onToast(`Cover đã lưu R2 · ${up.key}`)
  }

  const onEditorPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const cd = e.clipboardData
    if (!cd) return

    // 1) Image file → R2 (screenshot / copy image)
    const items = cd.items
    if (items?.length) {
      for (const item of Array.from(items)) {
        const file = fileFromClipboardItem(item)
        if (file) {
          e.preventDefault()
          await insertImageFromR2(file)
          return
        }
      }
    }

    // 2) Rich HTML (Word / Docs / Notion / browser) → Markdown
    const html = cd.getData('text/html')
    const plain = cd.getData('text/plain')
    if (html && shouldConvertHtmlPaste(html, plain)) {
      const md = htmlToMarkdown(html)
      if (md && md.trim()) {
        e.preventDefault()
        insertAtCursor(md)
        onToast('Đã dán thông minh: HTML → Markdown')
        return
      }
    }

    // 3) Plain markdown / text — browser default paste
  }

  const importDocxFile = async (file: File, mode: 'replace' | 'append' = 'replace') => {
    if (!draft || draft.deletedAt) {
      onToast('Chọn / tạo report trước khi import DOCX')
      return
    }
    if (!tokenInput.trim()) {
      onToast('Dán FEED_ADMIN_TOKEN trước — ảnh DOCX cần upload R2')
      return
    }
    setAdminToken(tokenInput)
    setImportingDocx(true)
    setUploadLabel(file.name)
    const result = await docxFileToReportMarkdown(file, {
      token: tokenInput,
      handle: draft.handle,
      onProgress: (msg) => setUploadLabel(msg),
    })
    setImportingDocx(false)
    setUploadLabel('')
    if (!result.ok) {
      onToast(`DOCX lỗi: ${result.error}`)
      return
    }

    const nextText =
      mode === 'append' && (draft.text || '').trim()
        ? `${draft.text.trim()}\n\n---\n\n${result.markdown}`
        : result.markdown

    setDraft((prev) => {
      if (!prev) return prev
      const metrics = { ...(prev.structured?.metrics || {}) }
      const prevRaw = String(metrics.r2ImageUrls || '')
      const prevList = prevRaw
        ? prevRaw.split('\n').map((s) => s.trim()).filter(Boolean)
        : []
      metrics.r2ImageUrls = [...prevList, ...result.imageUrls]
        .slice(-60)
        .join('\n')
      if (result.imageKeys[0]) metrics.lastR2Key = result.imageKeys[0]
      metrics.docxSource = result.sourceFilename
      metrics.docxImagesOk = result.imagesUploaded
      metrics.docxImagesFail = result.imagesFailed
      return {
        ...prev,
        text: nextText,
        sourceFilename: result.sourceFilename,
        structured: { ...(prev.structured || {}), metrics },
        title:
          prev.title && !prev.title.includes('Báo cáo mới')
            ? prev.title
            : `Báo cáo · @${prev.handle}`,
      }
    })
    setDirty(true)
    setViewMode('split')
    onToast(
      `DOCX → MD · ${result.chars.toLocaleString()} chars · ` +
        `${result.imagesUploaded} ảnh R2` +
        (result.imagesFailed ? ` · ${result.imagesFailed} ảnh lỗi` : ''),
    )
  }

  const onDocxPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let mode: 'replace' | 'append' = 'replace'
    if ((draft?.text || '').trim().length > 80) {
      const choice = window.confirm(
        'OK = thay toàn bộ nội dung bằng DOCX\nCancel = nối thêm (append) vào cuối',
      )
      mode = choice ? 'replace' : 'append'
    }
    await importDocxFile(file, mode)
  }

  const onEditorDrop = async (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (draft?.deletedAt) return
    const all = Array.from(e.dataTransfer?.files || [])
    const docx = all.find(
      (f) =>
        /\.docx$/i.test(f.name) ||
        (f.type || '').includes('wordprocessingml'),
    )
    if (docx) {
      await importDocxFile(docx, 'replace')
      return
    }
    const files = all.filter(isImageFile)
    if (!files.length) {
      onToast('Kéo thả ảnh (R2) hoặc file .docx')
      return
    }
    for (const f of files.slice(0, 5)) {
      await insertImageFromR2(f)
    }
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
                    <label className="akr-tpl-select" title="Chèn khung sẵn">
                      <span>Template</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value as ReportTemplateId | ''
                          e.target.value = ''
                          if (v) applyTemplate(v)
                        }}
                      >
                        <option value="" disabled>
                          Chọn khung…
                        </option>
                        {REPORT_TEMPLATES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
                      title="Upload ảnh thẳng lên Cloudflare R2"
                      disabled={uploading || importingDocx}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading
                        ? `R2… ${uploadLabel.slice(0, 12)}`
                        : '⬆ R2 Ảnh'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                      hidden
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        e.target.value = ''
                        for (const f of files.slice(0, 8)) {
                          await insertImageFromR2(f)
                        }
                      }}
                    />
                    <button
                      type="button"
                      title="Import DOCX → Markdown + ảnh lên R2"
                      disabled={uploading || importingDocx}
                      className="akr-docx-btn"
                      onClick={() => docxInputRef.current?.click()}
                    >
                      {importingDocx ? 'DOCX…' : '⬆ DOCX'}
                    </button>
                    <input
                      ref={docxInputRef}
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      hidden
                      onChange={(e) => void onDocxPick(e)}
                    />
                    <button
                      type="button"
                      title="Horizontal rule"
                      onClick={() => insertAtCursor('\n\n---\n\n')}
                    >
                      ―
                    </button>
                    <span
                      className="akr-md-tip"
                      title="Dán Word/Docs/Notion → MD · DOCX upload ảnh R2 · Preview Split"
                    >
                      DOCX+Paste → MD ✓
                    </span>
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
                  <div
                    className={`akr-write ${dragOver ? 'is-dragover' : ''}`}
                  >
                    <textarea
                      ref={textareaRef}
                      className="akr-textarea"
                      disabled={readOnly || uploading || importingDocx}
                      value={draft.text}
                      onChange={(e) => patchDraft({ text: e.target.value })}
                      onKeyDown={onMdKeyDown}
                      onPaste={(e) => void onEditorPaste(e)}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        if (!readOnly) setDragOver(true)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (!readOnly) setDragOver(true)
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => void onEditorDrop(e)}
                      spellCheck={false}
                      placeholder={
                        'Viết, dán, hoặc import DOCX…\n\n' +
                        '• ⬆ DOCX → Markdown đẹp + ảnh đẩy thẳng R2\n' +
                        '• Dán Word/Docs/Notion/ChatGPT → Markdown\n' +
                        '• Ảnh: paste / kéo thả / ⬆ R2 Ảnh\n' +
                        '• Template · Enter trong list · Split preview'
                      }
                    />
                    <div className="akr-write__hint">
                      {uploading || importingDocx ? (
                        <strong className="akr-uploading">
                          {importingDocx ? 'Import DOCX: ' : 'Upload R2: '}
                          {uploadLabel}…
                        </strong>
                      ) : (
                        <>
                          DOCX→MD+R2 · Paste HTML→MD · Ảnh→R2 · Template ·
                          Ctrl+B/I/S ·{' '}
                          {(draft.text || '').length.toLocaleString()} chars
                        </>
                      )}
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
                      Cover image (R2)
                      <div className="akr-cover-row">
                        <input
                          value={draft.coverImage || ''}
                          disabled={readOnly}
                          placeholder="URL public R2 sau upload"
                          onChange={(e) =>
                            patchDraft({ coverImage: e.target.value })
                          }
                        />
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              className="admin-btn admin-btn--primary"
                              disabled={uploading}
                              onClick={() => coverInputRef.current?.click()}
                            >
                              {uploading ? 'R2…' : '⬆ R2 Cover'}
                            </button>
                            <input
                              ref={coverInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              hidden
                              onChange={(e) => void onCoverUpload(e)}
                            />
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={setCoverFromUrl}
                            >
                              URL
                            </button>
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
                      <span className="admin-muted" style={{ fontSize: '0.72rem' }}>
                        Cover upload → Cloudflare R2 prefix{' '}
                        <code>kol-reports/images/</code>
                      </span>
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
