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
import { docxFileToReportMarkdown } from '../lib/docxToReportMarkdown'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { ReportMarkdown } from '../components/ReportMarkdown'
import type { Kol } from '../types'
import { resolveAvatarHandle } from '../lib/avatar'
import {
  collectTagStats,
  displayTags,
  normalizeTag,
  normalizeTags,
  parseTagInput,
  REPORT_TAG_PRESETS,
  smartMergeTags,
  suggestTagsFromText,
  tagsFromMapKol,
  toggleTag,
} from '../lib/reportTags'

interface Props {
  onToast: (msg: string) => void
  /** Map KOL list — Meta picker syncs handle/displayName */
  kols?: Kol[]
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

export function AdminKolReportsEditor({ onToast, kols = [] }: Props) {
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
  /** Split: fullscreen overlay + linked scroll Write ↔ Preview */
  const [splitFullscreen, setSplitFullscreen] = useState(false)
  const [scrollSync, setScrollSync] = useState(true)
  /** Local draft of selected report — changelog only on commit/save */
  const [draft, setDraft] = useState<KolReport | null>(null)
  const baselineRef = useRef<KolReport | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const editorShellRef = useRef<HTMLDivElement | null>(null)
  const scrollLockRef = useRef<'write' | 'preview' | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const docxInputRef = useRef<HTMLInputElement | null>(null)
  const [importingDocx, setImportingDocx] = useState(false)
  const [mapKolQuery, setMapKolQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState('')
  const bodySlotRef = useRef(1)

  const mapKolsSorted = useMemo(() => {
    return [...kols]
      .filter((k) => !k.hidden && k.handle)
      .sort((a, b) =>
        a.handle.localeCompare(b.handle, undefined, { sensitivity: 'base' }),
      )
  }, [kols])

  const mapKolMatches = useMemo(() => {
    const q = mapKolQuery.trim().toLowerCase().replace(/^@/, '')
    if (!q) return mapKolsSorted.slice(0, 40)
    return mapKolsSorted
      .filter(
        (k) =>
          k.handle.toLowerCase().includes(q) ||
          (k.displayName || '').toLowerCase().includes(q) ||
          (k.niche || '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [mapKolsSorted, mapKolQuery])

  const linkedMapKol = useMemo(() => {
    if (!draft?.handle) return null
    const h = draft.handle.toLowerCase()
    return (
      mapKolsSorted.find((k) => k.handle.toLowerCase() === h) || null
    )
  }, [draft?.handle, mapKolsSorted])

  /** Map casing for R2 avatars (case-sensitive keys on R2) */
  const avatarHandle = useCallback(
    (handle: string) => resolveAvatarHandle(handle, kols),
    [kols],
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

  // Fullscreen: Esc to exit + lock body scroll
  useEffect(() => {
    if (!splitFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSplitFullscreen(false)
      }
      // F11-like: Ctrl+Shift+F toggles
      if (e.key === 'f' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setSplitFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [splitFullscreen])

  const enterSplitFullscreen = useCallback(() => {
    setViewMode('split')
    setSplitFullscreen(true)
  }, [])

  const exitSplitFullscreen = useCallback(() => {
    setSplitFullscreen(false)
  }, [])

  /**
   * Sync scroll ratio between Write (textarea) and Preview pane.
   * Proportional mapping so long docs stay roughly aligned.
   */
  const syncScrollFrom = useCallback(
    (source: 'write' | 'preview') => {
      if (!scrollSync || viewMode !== 'split') return
      if (scrollLockRef.current && scrollLockRef.current !== source) return
      const writeEl = textareaRef.current
      const prevEl = previewRef.current
      if (!writeEl || !prevEl) return
      const a = source === 'write' ? writeEl : prevEl
      const b = source === 'write' ? prevEl : writeEl
      const aMax = a.scrollHeight - a.clientHeight
      const bMax = b.scrollHeight - b.clientHeight
      if (aMax <= 0) {
        b.scrollTop = 0
        return
      }
      if (bMax <= 0) return
      const ratio = Math.min(1, Math.max(0, a.scrollTop / aMax))
      scrollLockRef.current = source
      b.scrollTop = ratio * bMax
      // release lock after layout
      requestAnimationFrame(() => {
        scrollLockRef.current = null
      })
    },
    [scrollSync, viewMode],
  )

  const onWriteScroll = useCallback(() => {
    syncScrollFrom('write')
  }, [syncScrollFrom])

  const onPreviewScroll = useCallback(() => {
    syncScrollFrom('preview')
  }, [syncScrollFrom])

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
    setMapKolQuery(c.handle || '')
    // Resume body image slot counter for stable overwrite paths
    const slot = Number(c.structured?.metrics?.r2BodySlot)
    bodySlotRef.current =
      Number.isFinite(slot) && slot >= 1 ? Math.floor(slot) : 1
  }, [dataset, selectedId])

  const tagStats = useMemo(
    () => collectTagStats(dataset?.reports || []),
    [dataset],
  )

  const list = useMemo(() => {
    if (!dataset) return [] as KolReport[]
    const base = showTrash ? dataset.trash || [] : dataset.reports
    let rows = base
    if (!showTrash && visFilter !== 'all') {
      rows = rows.filter((r) => r.visibility === visFilter)
    }
    if (tagFilter) {
      const tf = tagFilter.toLowerCase()
      rows = rows.filter((r) =>
        displayTags(r.tags).some((t) => t.toLowerCase() === tf),
      )
    }
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) =>
          r.handle.includes(q) ||
          (r.displayName || '').toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q) ||
          displayTags(r.tags).some((t) => t.toLowerCase().includes(q)),
      )
    }
    return rows
  }, [dataset, query, showTrash, visFilter, tagFilter])

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
        tags: normalizeTags(d.tags),
        structured: d.structured,
      })
      // Preserve fields applyReportUpdate may not copy
      next.coverImage = d.coverImage
      next.sourceFilename = d.sourceFilename
      // Respect user-edited changelog (cleared / single deletes), then prepend this save's entry
      const head = next.changelog?.[0]
      const userLog = Array.isArray(d.changelog) ? d.changelog : []
      next.changelog = head
        ? [head, ...userLog.filter((c) => c.id !== head.id)].slice(0, 200)
        : userLog.slice(0, 200)
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
      onToast(
        'Đã ghi đè R2 · internal/kol-reports/v1.json (cùng key, không file mới)',
      )
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
    // Ctrl+Shift+F — toggle Split fullscreen
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      if (splitFullscreen) exitSplitFullscreen()
      else enterSplitFullscreen()
      return
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

  /**
   * Single path for every image: File → PUT /api/kol-report-image → R2.
   * Markdown only stores the returned public URL (never base64/blob).
   */
  const uploadFileToR2 = useCallback(
    async (
      file: File,
      mode: 'inline' | 'cover',
      slotOverride?: string,
    ): Promise<{ url: string; key: string; overwritten?: boolean } | null> => {
      if (!isImageFile(file)) {
        onToast('Chỉ PNG / JPEG / WebP / GIF — upload thẳng R2')
        return null
      }
      if (!tokenInput.trim()) {
        onToast('Dán FEED_ADMIN_TOKEN trước khi upload ảnh lên R2')
        return null
      }
      if (!draft?.id) {
        onToast('Chưa có report id')
        return null
      }
      setAdminToken(tokenInput)
      setUploading(true)
      setUploadLabel(file.name || 'image')

      let slot = slotOverride
      if (!slot) {
        if (mode === 'cover') slot = 'cover'
        else {
          slot = `body_${bodySlotRef.current}`
          bodySlotRef.current += 1
        }
      }

      // overwrite=1 → same key kol-reports/images/{reportId}/{slot}.ext
      const r = await uploadKolReportImage(file, {
        token: tokenInput,
        handle: draft.handle,
        overwrite: true,
        reportId: draft.id,
        slot,
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
      return { url: r.url, key: r.key, overwritten: r.overwritten }
    },
    [tokenInput, draft?.id, draft?.handle, onToast],
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
      // de-dupe by key prefix (strip ?v=)
      const clean = up.url.split('?')[0]
      const nextList = [
        ...prevList.filter((u) => !String(u).startsWith(clean)),
        up.url,
      ].slice(-40)
      metrics.r2ImageUrls = nextList.join('\n')
      metrics.lastR2Key = up.key
      metrics.r2BodySlot = bodySlotRef.current
      return {
        ...prev,
        structured: { ...(prev.structured || {}), metrics },
      }
    })
    setDirty(true)
    onToast(
      up.overwritten
        ? `Đã ghi đè R2 · ${up.key}`
        : `Đã lưu R2 · ${up.key}`,
    )
  }

  /** Link Meta fields to a KOL on the public map */
  const syncFromMapKol = (k: Kol) => {
    if (!draft || draft.deletedAt) return
    const handle = k.handle.replace(/^@/, '').toLowerCase()
    const displayName = k.displayName || handle
    const niches = tagsFromMapKol(k)
    const tags = smartMergeTags(draft.tags, {
      mapKol: k,
      text: draft.text,
      max: 12,
    })
    const title =
      !draft.title ||
      draft.title.startsWith('Báo cáo mới') ||
      draft.title.includes(draft.handle)
        ? `Báo cáo đánh giá KOL @${handle}`
        : draft.title
    setDraft((prev) => {
      if (!prev || prev.deletedAt) return prev
      return {
        ...prev,
        handle,
        displayName,
        title,
        tags,
        structured: {
          ...(prev.structured || {}),
          tierHint: k.rank || (k.tier != null ? String(k.tier) : null),
          niches,
          metrics: {
            ...(prev.structured?.metrics || {}),
            mapKolId: k.id,
            mapFollowers: k.followers,
            mapScore: k.score,
            mapSyncedAt: new Date().toISOString(),
          },
        },
      }
    })
    setDirty(true)
    setMapKolQuery(handle)
    onToast(
      `Đã sync Meta ← map @${handle}` +
        (tags.length ? ` · tags: ${tags.slice(0, 4).join(', ')}` : ''),
    )
  }

  const selectedTags = useMemo(
    () => displayTags(draft?.tags),
    [draft?.tags],
  )

  const suggestedTags = useMemo(() => {
    if (!draft) return [] as string[]
    const fromText = suggestTagsFromText(draft.text || '')
    const fromMap = linkedMapKol ? tagsFromMapKol(linkedMapKol) : []
    const fromStats = tagStats.map((s) => s.tag)
    const selected = new Set(selectedTags.map((t) => t.toLowerCase()))
    return normalizeTags([
      ...fromMap,
      ...fromText,
      ...REPORT_TAG_PRESETS,
      ...fromStats,
    ]).filter((t) => !selected.has(t.toLowerCase()))
  }, [draft, linkedMapKol, selectedTags, tagStats])

  const addCustomTag = () => {
    const parsed = parseTagInput(tagDraft)
    if (!parsed.length) return
    patchDraft({
      tags: normalizeTags([...(draft?.tags || []), ...parsed]),
    })
    setTagDraft('')
  }

  const autoTagFromContent = () => {
    if (!draft) return
    const next = smartMergeTags(draft.tags, {
      mapKol: linkedMapKol,
      text: draft.text,
      max: 12,
    })
    patchDraft({ tags: next })
    onToast(
      next.length
        ? `Auto-tag: ${next.join(', ')}`
        : 'Không gợi ý được tag từ nội dung',
    )
  }

  const clearChangelog = () => {
    if (!draft || draft.deletedAt) return
    if (!(draft.changelog || []).length) {
      onToast('Changelog đã trống')
      return
    }
    if (
      !confirm(
        `Xóa toàn bộ ${(draft.changelog || []).length} mục changelog? (sẽ lưu lên R2 khi Save)`,
      )
    ) {
      return
    }
    patchDraft({ changelog: [] })
    onToast('Đã xóa changelog — Save R2 để ghi đè dataset')
  }

  const removeChangelogEntry = (id: string) => {
    if (!draft || draft.deletedAt) return
    patchDraft({
      changelog: (draft.changelog || []).filter((c) => c.id !== id),
    })
    setDirty(true)
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
    // Always slot=cover → overwrite same R2 object for this report
    const up = await uploadFileToR2(file, 'cover', 'cover')
    if (!up) return
    patchDraft({ coverImage: up.url })
    onToast(
      up.overwritten
        ? `Cover ghi đè R2 · ${up.key}`
        : `Cover đã lưu R2 · ${up.key}`,
    )
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
      reportId: draft.id,
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
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={() => void reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary admin-btn--sm"
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
        {tagStats.length > 0 && (
          <div className="akr-tag-filter" title="Lọc theo tag">
            <button
              type="button"
              className={`akr-tag-chip akr-tag-chip--filter ${!tagFilter ? 'is-on' : ''}`}
              onClick={() => setTagFilter(null)}
            >
              All tags
            </button>
            {tagStats.slice(0, 12).map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={`akr-tag-chip akr-tag-chip--filter ${
                  tagFilter?.toLowerCase() === tag.toLowerCase() ? 'is-on' : ''
                }`}
                onClick={() =>
                  setTagFilter((prev) =>
                    prev?.toLowerCase() === tag.toLowerCase() ? null : tag,
                  )
                }
              >
                {tag}
                <em>{count}</em>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm"
          onClick={addReport}
        >
          + New report
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--sm"
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
        <label className="admin-btn admin-btn--ghost admin-btn--sm akr-file-btn">
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
          className="admin-btn admin-btn--ghost admin-btn--sm"
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
                      handle={avatarHandle(r.handle)}
                      name={r.displayName || r.handle}
                      size={36}
                      liveFallback
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
                  {displayTags(r.tags).length > 0 && (
                    <span className="akr-card__tags">
                      {displayTags(r.tags)
                        .slice(0, 3)
                        .map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      {displayTags(r.tags).length > 3 ? (
                        <span>+{displayTags(r.tags).length - 3}</span>
                      ) : null}
                    </span>
                  )}
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
                  className="admin-btn admin-btn--primary admin-btn--sm"
                  onClick={addReport}
                >
                  + New report
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
                className="admin-btn admin-btn--primary admin-btn--sm"
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
                  handle={avatarHandle(draft.handle)}
                  name={draft.displayName || draft.handle}
                  size={44}
                  liveFallback
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
                        className={`admin-btn admin-btn--sm ${
                          draft.visibility === 'public'
                            ? 'admin-btn--ghost'
                            : 'admin-btn--primary'
                        }`}
                        onClick={togglePublish}
                      >
                        {draft.visibility === 'public'
                          ? 'Private'
                          : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm admin-btn--danger"
                        onClick={softDelete}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {readOnly && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary admin-btn--sm"
                      onClick={restore}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={editorShellRef}
                className={`akr-editor-shell ${
                  splitFullscreen ? 'is-fullscreen' : ''
                } ${viewMode === 'preview' ? 'is-reader' : ''}`}
              >
              <div className="akr-editor-chrome">
                <div className="akr-editor-chrome__row akr-editor-chrome__row--primary">
                  <div className="akr-seg akr-seg--sm">
                    {(
                      [
                        ['write', 'Write'],
                        ['split', 'Split'],
                        ['preview', 'Đọc'],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        className={`akr-seg__btn ${viewMode === k ? 'is-active' : ''}`}
                        onClick={() => {
                          setViewMode(k)
                          if (k !== 'split' && splitFullscreen) {
                            setSplitFullscreen(false)
                          }
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="akr-split-controls">
                    {viewMode === 'split' && (
                      <label
                        className={`akr-sync-toggle ${scrollSync ? 'is-on' : ''}`}
                        title="Đồng bộ scroll Write ↔ Preview"
                      >
                        <input
                          type="checkbox"
                          checked={scrollSync}
                          onChange={(e) => setScrollSync(e.target.checked)}
                        />
                        Sync
                      </label>
                    )}
                    <button
                      type="button"
                      className={`admin-btn admin-btn--sm akr-fs-btn ${
                        splitFullscreen
                          ? 'admin-btn--primary is-active'
                          : 'admin-btn--ghost'
                      }`}
                      title={
                        splitFullscreen
                          ? 'Thoát fullscreen (Esc)'
                          : 'Fullscreen — chỉnh / đọc rộng'
                      }
                      onClick={() => {
                        if (splitFullscreen) exitSplitFullscreen()
                        else {
                          if (viewMode === 'write') setViewMode('split')
                          enterSplitFullscreen()
                        }
                      }}
                    >
                      {splitFullscreen ? 'Exit full' : 'Fullscreen'}
                    </button>
                    {splitFullscreen && (
                      <span className="akr-fs-hint">Esc</span>
                    )}
                  </div>
                </div>
                {!readOnly && viewMode !== 'preview' ? (
                  <div className="akr-editor-chrome__row akr-editor-chrome__row--tools">
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
                        URL
                      </button>
                      <button
                        type="button"
                        title="Upload ảnh R2"
                        disabled={uploading || importingDocx}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading
                          ? `R2…`
                          : 'R2 Ảnh'}
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
                        title="Import DOCX → Markdown + ảnh R2"
                        disabled={uploading || importingDocx}
                        className="akr-docx-btn"
                        onClick={() => docxInputRef.current?.click()}
                      >
                        {importingDocx ? 'DOCX…' : 'DOCX'}
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
                    </div>
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
                }${scrollSync && viewMode === 'split' ? ' akr-editor--sync' : ''}`}
              >
                {viewMode !== 'preview' && (
                  <div
                    className={`akr-write ${dragOver ? 'is-dragover' : ''}`}
                  >
                    <div className="akr-pane-label">Write</div>
                    <textarea
                      ref={textareaRef}
                      className="akr-textarea"
                      disabled={readOnly || uploading || importingDocx}
                      value={draft.text}
                      onChange={(e) => patchDraft({ text: e.target.value })}
                      onKeyDown={onMdKeyDown}
                      onPaste={(e) => void onEditorPaste(e)}
                      onScroll={onWriteScroll}
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
                        '• Split + Fullscreen + Sync scroll để chỉnh dễ'
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
                          {viewMode === 'split' && scrollSync
                            ? 'Scroll sync ON · '
                            : ''}
                          {splitFullscreen ? 'Fullscreen · Esc thoát · ' : ''}
                          DOCX→MD+R2 · Ctrl+B/I/S ·{' '}
                          {(draft.text || '').length.toLocaleString()} chars
                        </>
                      )}
                    </div>
                  </div>
                )}
                {viewMode !== 'write' && (
                  <div
                    ref={previewRef}
                    className="akr-preview"
                    onScroll={onPreviewScroll}
                  >
                    {viewMode === 'split' && (
                      <div className="akr-pane-label akr-pane-label--preview">
                        Preview
                        {scrollSync ? (
                          <span className="akr-sync-badge">synced</span>
                        ) : null}
                      </div>
                    )}
                    <div
                      className={
                        viewMode === 'preview'
                          ? 'akr-reader'
                          : 'akr-preview-body'
                      }
                    >
                      {viewMode === 'preview' && (
                        <header className="akr-reader__head">
                          <p className="akr-reader__kicker">KOL Report</p>
                          <h2 className="akr-reader__title">{draft.title}</h2>
                          <div className="akr-reader__meta">
                            <span>@{draft.handle}</span>
                            {score != null && (
                              <span className="akr-score-chip">
                                {score}/100
                              </span>
                            )}
                            <span
                              className={`akr-badge ${
                                draft.visibility === 'public'
                                  ? 'akr-badge--pub'
                                  : ''
                              }`}
                            >
                              {draft.visibility}
                            </span>
                            <time dateTime={draft.updatedAt}>
                              {new Date(draft.updatedAt).toLocaleString()}
                            </time>
                          </div>
                        </header>
                      )}
                      <ReportMarkdown
                        text={draft.text}
                        className={
                          viewMode === 'preview'
                            ? 'report-md--reader'
                            : 'report-md--preview'
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
              </div>

              {!splitFullscreen && (
              <>
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
                  <div className="akr-map-link">
                    <div className="akr-map-link__head">
                      <strong>Map KOL</strong>
                      <span className="admin-muted">
                        Chọn KOL trên map → sync handle / name / niche
                        {mapKolsSorted.length
                          ? ` · ${mapKolsSorted.length} accounts`
                          : ' · (chưa load map)'}
                      </span>
                    </div>
                    <input
                      className="admin-search"
                      placeholder="Tìm handle / tên trên map…"
                      disabled={readOnly}
                      value={mapKolQuery}
                      onChange={(e) => setMapKolQuery(e.target.value)}
                    />
                    {linkedMapKol ? (
                      <div className="akr-map-linked">
                        {/* No avatar here — report head already shows profile */}
                        <div className="akr-map-linked__info">
                          <span className="akr-map-linked__ok" aria-hidden>
                            ✓
                          </span>
                          <div>
                            <strong>Đã gắn map · @{linkedMapKol.handle}</strong>
                            <small>
                              {linkedMapKol.displayName}
                              {linkedMapKol.rank
                                ? ` · ${linkedMapKol.rank}`
                                : ''}
                              {linkedMapKol.niche
                                ? ` · ${linkedMapKol.niche}`
                                : ''}
                              {linkedMapKol.followers
                                ? ` · ${linkedMapKol.followers.toLocaleString()} fl`
                                : ''}
                            </small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          disabled={readOnly}
                          onClick={() => syncFromMapKol(linkedMapKol)}
                        >
                          Re-sync
                        </button>
                      </div>
                    ) : (
                      <p className="admin-muted akr-map-link__hint">
                        Handle chưa khớp map — chọn bên dưới để gán.
                      </p>
                    )}
                    {!readOnly && (
                      <ul className="akr-map-list">
                        {mapKolMatches
                          .filter(
                            (k) =>
                              k.handle.toLowerCase() !==
                              draft.handle.toLowerCase(),
                          )
                          .map((k) => (
                            <li key={k.id}>
                              <button
                                type="button"
                                onClick={() => syncFromMapKol(k)}
                              >
                                <XProfileAvatar
                                  handle={k.handle}
                                  name={k.displayName}
                                  size={22}
                                  liveFallback
                                />
                                <span>
                                  <strong>@{k.handle}</strong>
                                  <small>
                                    {k.displayName}
                                    {k.rank ? ` · ${k.rank}` : ''}
                                    {k.niche ? ` · ${k.niche}` : ''}
                                  </small>
                                </span>
                              </button>
                            </li>
                          ))}
                        {!mapKolMatches.filter(
                          (k) =>
                            k.handle.toLowerCase() !==
                            draft.handle.toLowerCase(),
                        ).length && (
                          <li className="admin-muted" style={{ padding: 8 }}>
                            {linkedMapKol
                              ? 'Đã gắn map. Tìm handle khác để đổi.'
                              : 'Không thấy KOL phù hợp trên map.'}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="admin-ts-fields" style={{ marginTop: 14 }}>
                    <label>
                      Handle
                      <input
                        value={draft.handle}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchDraft({
                            handle: e.target.value
                              .replace(/^@/, '')
                              .toLowerCase(),
                          })
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
                    <div className="akr-vis-field admin-ts-fields--full">
                      <span className="akr-vis-field__label">Visibility</span>
                      <div
                        className="akr-vis-toggle"
                        role="group"
                        aria-label="Visibility"
                      >
                        <button
                          type="button"
                          disabled={readOnly}
                          className={`akr-vis-toggle__btn ${
                            draft.visibility === 'private' ? 'is-active is-private' : ''
                          }`}
                          onClick={() =>
                            patchDraft({ visibility: 'private' })
                          }
                        >
                          <span className="akr-vis-toggle__dot" aria-hidden />
                          Private
                          <small>Chỉ admin</small>
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          className={`akr-vis-toggle__btn ${
                            draft.visibility === 'public' ? 'is-active is-public' : ''
                          }`}
                          onClick={() => patchDraft({ visibility: 'public' })}
                        >
                          <span className="akr-vis-toggle__dot" aria-hidden />
                          Public
                          <small>Minh bạch / publish</small>
                        </button>
                      </div>
                      <p className="akr-vis-field__hint admin-muted">
                        {draft.visibility === 'public'
                          ? 'Report public sẽ hiện qua API công khai (GET /api/kol-reports).'
                          : 'Report private chỉ admin xem (GET ?all=1 + token).'}
                      </p>
                    </div>
                    <div className="akr-tags-field admin-ts-fields--full">
                      <div className="akr-tags-field__head">
                        <span className="akr-vis-field__label">Tags</span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            onClick={autoTagFromContent}
                            title="Gợi ý từ nội dung + map niche"
                          >
                            Auto-tag
                          </button>
                        )}
                      </div>
                      <div className="akr-tags-selected">
                        {selectedTags.length === 0 && (
                          <span className="admin-muted akr-tags-empty">
                            Chưa có tag — bấm gợi ý hoặc Auto-tag
                          </span>
                        )}
                        {selectedTags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="akr-tag-chip is-selected"
                            disabled={readOnly}
                            title="Gỡ tag"
                            onClick={() =>
                              patchDraft({
                                tags: toggleTag(draft.tags || [], t),
                              })
                            }
                          >
                            {t}
                            {!readOnly && <span aria-hidden>×</span>}
                          </button>
                        ))}
                      </div>
                      {!readOnly && (
                        <>
                          <div className="akr-tags-suggest">
                            {suggestedTags.slice(0, 16).map((t) => (
                              <button
                                key={t}
                                type="button"
                                className="akr-tag-chip akr-tag-chip--suggest"
                                onClick={() =>
                                  patchDraft({
                                    tags: toggleTag(draft.tags || [], t),
                                  })
                                }
                              >
                                + {t}
                              </button>
                            ))}
                          </div>
                          <div className="akr-tags-add">
                            <input
                              value={tagDraft}
                              placeholder="Thêm tag tùy chỉnh… (Enter)"
                              onChange={(e) => setTagDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  addCustomTag()
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost admin-btn--sm"
                              disabled={!normalizeTag(tagDraft)}
                              onClick={addCustomTag}
                            >
                              Thêm
                            </button>
                          </div>
                        </>
                      )}
                    </div>
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
                              className="admin-btn admin-btn--primary admin-btn--sm"
                              disabled={uploading}
                              onClick={() => coverInputRef.current?.click()}
                            >
                              {uploading ? 'R2…' : 'R2 Cover'}
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
                              className="admin-btn admin-btn--ghost admin-btn--sm"
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
                  <div className="akr-log-actions">
                    <span className="admin-muted">
                      {(draft.changelog || []).length} mục · Save R2 để ghi
                      đè dataset (cùng key, không tạo file mới)
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={!(draft.changelog || []).length}
                        onClick={clearChangelog}
                      >
                        Xóa hết changelog
                      </button>
                    )}
                  </div>
                  <ul className="admin-kol-changelog">
                    {(draft.changelog || []).slice(0, 50).map((c) => (
                      <li key={c.id}>
                        <div className="admin-kol-changelog__meta">
                          <strong>{c.action}</strong>
                          <time dateTime={c.at}>
                            {new Date(c.at).toLocaleString()}
                          </time>
                          {c.by && <span>by {c.by}</span>}
                          {!readOnly && (
                            <button
                              type="button"
                              className="akr-log-del"
                              title="Xóa mục này"
                              onClick={() => removeChangelogEntry(c.id)}
                            >
                              ×
                            </button>
                          )}
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
