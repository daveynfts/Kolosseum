import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FeedPost, Tier1Feed } from '../types/feed'
import type { Kol } from '../types'
import { getKolRank } from '../types'
import {
  archiveOldPosts,
  clearFeedStore,
  countArchivablePosts,
  createEmptyPost,
  exportFeedJson,
  fetchSeedFeed,
  fetchXStatusFromUrl,
  getAdminToken,
  hasFeedOverride,
  importFeedJson,
  loadFeedWithSource,
  normalizePost,
  saveFeedLocal,
  saveFeedToServer,
  setAdminToken,
  sortPostsLatest,
  type FeedSource,
} from '../lib/feedStore'
import { AvatarImg } from '../components/AvatarImg'
import { NICHE_COLORS } from '../types'
import { adminQueryTokens, matchesAdminTokens } from '../lib/adminSearch'
import {
  confirmDiscardUnsaved,
  useDirtyRef,
  useRegisterAdminOps,
  useRemoteDatasetLoad,
} from '../lib/adminLoadGuard'

interface Props {
  kols: Kol[]
  onToast: (msg: string) => void
  /** Increment from parent header to force-create a post */
  addSignal?: number
}

function emptyFeed(): Tier1Feed {
  return {
    generatedAt: new Date().toISOString(),
    source: 'admin',
    mode: 'admin',
    tier: 1,
    kolCount: 0,
    handles: [],
    postCount: 0,
    posts: [],
  }
}

export function AdminFeedEditor({ kols, onToast, addSignal = 0 }: Props) {
  const [feed, setFeed] = useState<Tier1Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingServer, setSavingServer] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<FeedPost | null>(null)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useDirtyRef(dirty)
  const [query, setQuery] = useState('')
  const [feedSource, setFeedSource] = useState<FeedSource | 'unknown'>('unknown')
  const [, setIsOverride] = useState(() => hasFeedOverride())
  const [xUrl, setXUrl] = useState('')
  const [fetchingX, setFetchingX] = useState(false)
  const [lastFetchNote, setLastFetchNote] = useState<string | null>(null)
  const [lastFetchOk, setLastFetchOk] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { feed: data, source } = await loadFeedWithSource()
      if (dirtyRef.current) {
        setLoading(false)
        return
      }
      setFeed(data)
      setFeedSource(source)
      setIsOverride(hasFeedOverride())
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Load feed failed')
      setFeed(emptyFeed())
      setFeedSource('local')
    } finally {
      setLoading(false)
    }
  }, [onToast, dirtyRef])

  useRemoteDatasetLoad(
    () =>
      loadFeedWithSource().catch(() => ({
        feed: emptyFeed(),
        source: 'local' as const,
      })),
    dirtyRef,
    (r) => {
      setFeed(r.feed)
      setFeedSource(r.source)
      setIsOverride(hasFeedOverride())
      setLoading(false)
    },
  )

  const selected = useMemo(
    () => feed?.posts.find((p) => p.id === selectedId) ?? null,
    [feed, selectedId],
  )

  useEffect(() => {
    if (selected) {
      setDraft(JSON.parse(JSON.stringify(selected)) as FeedPost)
      setDirty(false)
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!feed) return []
    const tokens = adminQueryTokens(query)
    let list = sortPostsLatest(feed.posts)
    if (tokens.length > 0) {
      list = list.filter((p) => {
        const hay = [p.handle, p.displayName, p.text, p.url || ''].join(' ')
        return matchesAdminTokens(hay, tokens)
      })
    }
    return list
  }, [feed, query])

  /** Challenger + Master handles for feed authorship */
  const feedHandles = useMemo(
    () =>
      kols
        .filter((k) => {
          if (k.hidden) return false
          const r = getKolRank(k)
          return r === 'challenger' || r === 'master'
        })
        .sort(
          (a, b) =>
            (getKolRank(a) === 'challenger' ? 0 : 1) -
              (getKolRank(b) === 'challenger' ? 0 : 1) ||
            b.score - a.score ||
            a.handle.localeCompare(b.handle),
        )
        .map((k) => k.handle),
    [kols],
  )

  const archivableCount = useMemo(
    () => (feed ? countArchivablePosts(feed) : 0),
    [feed],
  )

  const buildFeedWithDraft = (): Tier1Feed | null => {
    if (!feed || !draft) return null
    const fixed = normalizePost({
      ...draft,
      handle: draft.handle.replace(/^@/, '').trim(),
      avatarLocal: `/avatars/${draft.handle.replace(/^@/, '').trim()}.jpg`,
      url:
        draft.url?.trim() ||
        `https://x.com/${draft.handle.replace(/^@/, '').trim()}`,
    })
    const posts = feed.posts.some((p) => p.id === fixed.id)
      ? feed.posts.map((p) => (p.id === fixed.id ? fixed : p))
      : [fixed, ...feed.posts]
    return { ...feed, posts }
  }

  const onSaveServer = async () => {
    const next = buildFeedWithDraft() || feed
    if (!next) {
      onToast('Chưa có feed để lưu')
      return
    }
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops rồi Save')
      return
    }
    setAdminToken(token)
    setSavingServer(true)
    // Cache mirror after preparing payload (not a user-facing “local save”)
    const local = saveFeedLocal(next, 'before server')
    setFeed(local)
    const result = await saveFeedToServer(local, 'admin save', token)
    setSavingServer(false)
    if (result.ok) {
      setFeed(result.feed)
      setFeedSource('server')
      setIsOverride(true)
      setDirty(false)
      if (draft) {
        const fixed = result.feed.posts.find((p) => p.id === draft.id)
        if (fixed) setDraft(fixed)
      }
      onToast('Đã publish feed R2 — mọi user sẽ thấy')
    } else {
      const hint =
        result.status === 401
          ? ' — Token sai hoặc khác FEED_ADMIN_TOKEN (Production).'
          : ''
      onToast(`Server lỗi: ${result.error}${hint}`)
    }
  }

  const onSyncXUrl = async () => {
    const url = xUrl.trim()
    if (!url) {
      onToast('Dán link bài X (x.com/.../status/...) rồi Sync')
      return
    }
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops rồi Sync')
      return
    }
    setAdminToken(token)
    setFetchingX(true)
    setLastFetchNote(null)
    setLastFetchOk(null)
    try {
      const result = await fetchXStatusFromUrl(url, token)
      if (!result.ok) {
        const note = `Sync X lỗi: ${result.error}`
        setLastFetchOk(false)
        setLastFetchNote(note)
        onToast(note)
        return
      }
      const p = result.post
      const kol = kols.find(
        (k) => k.handle.toLowerCase() === p.handle.toLowerCase(),
      )
      const merged = normalizePost({
        id: p.id,
        handle: p.handle,
        displayName: kol?.displayName || p.displayName,
        text: p.text,
        createdAt: p.createdAt,
        likes: p.likes,
        reposts: p.reposts,
        replies: p.replies,
        views: p.views,
        media: p.media,
        isReply: p.isReply,
        url: p.url,
        avatarLocal: `/avatars/${p.handle}.jpg`,
      })

      let base = feed ?? emptyFeed()
      if (dirty && draft && draft.id !== merged.id) {
        const emptyStub =
          draft.id.startsWith('admin-') &&
          !draft.text.trim() &&
          !(draft.media && draft.media.length)
        if (emptyStub) {
          base = { ...base, posts: base.posts.filter((x) => x.id !== draft.id) }
        } else {
          const withDraft = buildFeedWithDraft()
          if (withDraft) base = withDraft
        }
      }

      const exists = base.posts.some((x) => x.id === merged.id)
      const posts = exists
        ? base.posts.map((x) => (x.id === merged.id ? merged : x))
        : [merged, ...base.posts]
      const next = {
        ...base,
        posts,
        generatedAt: new Date().toISOString(),
      }

      setSelectedId(merged.id)
      setDraft(merged)
      setLoading(false)
      setSavingServer(true)
      const local = saveFeedLocal(next, 'x sync')
      setFeed(local)
      const saved = await saveFeedToServer(local, 'admin x sync', token)

      const cached = result.cache?.imagesCached ?? 0
      const total = result.cache?.imagesTotal ?? p.media?.length ?? 0
      const imgBit =
        total > 0 ? ` · ảnh ${cached}/${total} R2` : ' · không có ảnh'

      if (saved.ok) {
        setFeed(saved.feed)
        setFeedSource('server')
        setIsOverride(true)
        setDirty(false)
        const fixed = saved.feed.posts.find((x) => x.id === merged.id)
        if (fixed) setDraft(fixed)
        setXUrl('')
        const note = `Đã ${exists ? 'cập nhật' : 'thêm'} @${p.handle}${imgBit} → feed R2`
        setLastFetchOk(true)
        setLastFetchNote(note)
        onToast(note)
      } else {
        setDirty(true)
        const hint =
          saved.status === 401
            ? ' — token sai hoặc khác FEED_ADMIN_TOKEN.'
            : ''
        const note = `Đã fill @${p.handle}${imgBit} nhưng Save R2 lỗi: ${saved.error}${hint}`
        setLastFetchOk(false)
        setLastFetchNote(note)
        onToast(note)
      }
    } finally {
      setFetchingX(false)
      setSavingServer(false)
    }
  }

  const onAdd = useCallback(() => {
    setFeed((prev) => {
      const base = prev ?? emptyFeed()
      const handle = feedHandles[0] || 'new_handle'
      const kol = kols.find((k) => k.handle.toLowerCase() === handle.toLowerCase())
      const p = createEmptyPost(handle)
      if (kol) {
        p.displayName = kol.displayName
        p.avatarLocal = `/avatars/${kol.handle}.jpg`
      }
      setSelectedId(p.id)
      setDraft(p)
      setDirty(true)
      setLoading(false)
      onToast('Đã tạo post — điền nội dung rồi bấm Save post')
      return { ...base, posts: [p, ...base.posts] }
    })
  }, [kols, onToast, feedHandles])

  const onArchiveOld = () => {
    if (!feed) return
    const n = countArchivablePosts(feed)
    if (n === 0) {
      onToast('Không có post nào cũ hơn 7 ngày trong feed live')
      return
    }
    if (
      !confirm(
        `Archive ${n} post cũ hơn 14 ngày? Chúng sẽ ra khỏi X Feed live (vẫn giữ trong archivedPosts).`,
      )
    ) {
      return
    }
    const { feed: next, moved } = archiveOldPosts(feed)
    setFeed(next)
    setDirty(true)
    if (draft && !next.posts.some((p) => p.id === draft.id)) {
      setSelectedId(null)
      setDraft(null)
    }
    onToast(
      `Đã archive ${moved} post (chưa publish) — bấm Save để đẩy R2 · archive total ${next.archivedCount ?? 0}`,
    )
  }

  // Parent header "+ Add post" signal
  useEffect(() => {
    if (addSignal > 0) onAdd()
  }, [addSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDelete = () => {
    if (!feed || !draft) return
    if (!confirm(`Xóa post của @${draft.handle}?`)) return
    const posts = feed.posts.filter((p) => p.id !== draft.id)
    setFeed({ ...feed, posts })
    setDirty(true)
    setSelectedId(null)
    setDraft(null)
    onToast('Đã xóa post khỏi draft — bấm Save để publish R2')
  }

  const onResetSeed = async () => {
    if (
      !confirm(
        'Load lại seed tier1-feed.json vào editor? Cần Save để publish seed lên R2.',
      )
    )
      return
    clearFeedStore()
    try {
      const seed = await fetchSeedFeed()
      setFeed(seed)
      setSelectedId(null)
      setDraft(null)
      setDirty(true)
      setIsOverride(false)
      setFeedSource('seed')
      onToast('Đã load seed — bấm Save để publish R2')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Reset failed')
    }
  }

  const onExport = () => {
    if (!feed) return
    const blob = new Blob([exportFeedJson(feed)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vn-kol-feed-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    onToast('Exported feed JSON')
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const data = importFeedJson(text)
      setFeed(data)
      setSelectedId(null)
      setDraft(null)
      setDirty(true)
      onToast(
        `Imported ${data.posts.length} posts — bấm Save để publish R2`,
      )
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const patchDraft = <K extends keyof FeedPost>(key: K, value: FeedPost[K]) => {
    if (!draft) return
    setDraft({ ...draft, [key]: value })
    setDirty(true)
  }

  /** When handle changes, keep URL / avatar / displayName in sync. */
  const onHandleChange = (raw: string) => {
    if (!draft) return
    const handle = raw.replace(/^@/, '').trim()
    const prev = draft.handle
    const kol = kols.find((k) => k.handle.toLowerCase() === handle.toLowerCase())

    // Display name: map KOL name if known; else if still defaulted to old handle, follow new handle
    let displayName = draft.displayName
    if (kol) {
      displayName = kol.displayName
    } else if (
      !displayName ||
      displayName === prev ||
      displayName === `@${prev}` ||
      displayName.toLowerCase() === prev.toLowerCase()
    ) {
      displayName = handle || draft.displayName
    }

    // URL: always refresh profile link; rewrite status URLs that used old handle
    let url = `https://x.com/${handle}`
    const oldUrl = draft.url || ''
    if (oldUrl.includes('/status/') && prev) {
      url = oldUrl.replace(
        new RegExp(`x\\.com/${prev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        `x.com/${handle}`,
      )
      if (!url.includes(handle)) url = `https://x.com/${handle}`
    }

    const avatarLocal = `/avatars/${handle}.jpg`

    setDraft({
      ...draft,
      handle,
      displayName,
      url,
      avatarLocal,
    })
    setDirty(true)
  }

  const mediaText = draft?.media?.join('\n') ?? ''

  useRegisterAdminOps('feed', {
    dirty,
    saving: savingServer,
    source: feedSource,
    updatedAt: feed?.generatedAt ?? null,
    save: () => void onSaveServer(),
    reload: () => {
      if (!confirmDiscardUnsaved(dirty)) return
      void refresh()
    },
  })

  return (
    <div className="admin-feed">
      <div className="admin-feed-sync">
        <label className="admin-feed-sync__url">
          <span>Link bài X</span>
          <input
            type="url"
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            placeholder="https://x.com/user/status/…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onSyncXUrl()
              }
            }}
            disabled={fetchingX || savingServer}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSyncXUrl()}
          disabled={fetchingX || savingServer || !xUrl.trim()}
          title="Lấy text + ảnh từ X, cache ảnh R2, rồi publish feed"
        >
          {fetchingX
            ? 'Đang lấy X…'
            : savingServer
              ? 'Đang lưu R2…'
              : 'Sync → R2'}
        </button>
        {lastFetchNote ? (
          <span
            className={
              lastFetchOk === false
                ? 'admin-feed-sync__note admin-feed-sync__note--err'
                : 'admin-feed-sync__note'
            }
          >
            {lastFetchNote}
          </span>
        ) : (
          <span className="admin-feed-sync__hint">
            Dán link → Sync: tự fill text/ảnh và lưu feed lên R2
          </span>
        )}
      </div>

      <div className="admin-feed-toolbar">
        <label className="admin-search-wrap" style={{ flex: '1 1 160px' }}>
          <span className="admin-search-wrap__icon" aria-hidden>
            ⌕
          </span>
          <input
            type="text"
            className="admin-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm @handle, nội dung…"
            aria-label="Filter posts"
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn" onClick={onAdd}>
          + Add
        </button>
        <button
          type="button"
          className="btn"
          onClick={onArchiveOld}
          disabled={!feed || archivableCount === 0}
          title="Chuyển post cũ hơn 14 ngày sang archivedPosts"
        >
          Archive &gt;14d{archivableCount > 0 ? ` (${archivableCount})` : ''}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSaveServer()}
          disabled={savingServer || !feed || !dirty}
        >
          {savingServer ? 'Saving…' : 'Save (R2)'}
        </button>
        <button type="button" className="btn" onClick={onExport} disabled={!feed}>
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
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => void onResetSeed()}
        >
          Seed
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!confirmDiscardUnsaved(dirty)) return
            void refresh()
          }}
        >
          Reload
        </button>
      </div>

      {loading && !feed ? (
        <div className="admin-empty glass">
          <p>Loading feed…</p>
          <button type="button" className="btn btn--primary" onClick={onAdd}>
            + Add post ngay
          </button>
        </div>
      ) : (
        <div className="admin-edit-layout">
          <div className="admin-edit-side">
            <div className="admin-side-list-head">
              <strong>Posts ({filtered.length})</strong>
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                + Add
              </button>
            </div>
            <div className="admin-side-list">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`admin-side-item ${selectedId === p.id ? 'is-active' : ''}`}
                  onClick={() => {
                    if (
                      dirty &&
                      selectedId &&
                      selectedId !== p.id &&
                      !confirmDiscardUnsaved(true)
                    ) {
                      return
                    }
                    setSelectedId(p.id)
                  }}
                >
                  <AvatarImg
                    handle={p.handle}
                    name={p.displayName}
                    size={28}
                    color={
                      NICHE_COLORS[
                        kols.find(
                          (k) => k.handle.toLowerCase() === p.handle.toLowerCase(),
                        )?.niche ?? 'Multi'
                      ]
                    }
                  />
                  <span>
                    <strong>@{p.handle}</strong>
                    <small>
                      {p.text.slice(0, 48)}
                      {p.text.length > 48 ? '…' : ''}
                    </small>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="admin-empty">
                  <p>
                    {query.trim()
                      ? `Không có post khớp “${query.trim()}”`
                      : 'Chưa có post'}
                  </p>
                  {!query.trim() && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={onAdd}
                    >
                      + Add post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="admin-editor glass">
            {!draft ? (
              <div className="admin-empty">
                <p>Chọn post bên trái hoặc tạo mới</p>
                <button type="button" className="btn btn--primary" onClick={onAdd}>
                  + Add post
                </button>
              </div>
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
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void onSaveServer()}
                      disabled={savingServer}
                    >
                      {savingServer ? 'Saving…' : 'Save (R2)'}
                    </button>
                    <button type="button" className="btn btn--danger" onClick={onDelete}>
                      Delete
                    </button>
                  </div>
                </div>

                <section className="admin-section">
                  <h3>Post content</h3>
                  <div className="admin-fields">
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Handle (đổi handle → auto URL / avatar / name)
                      </span>
                      <input
                        list="feed-kol-handles"
                        value={draft.handle}
                        onChange={(e) => onHandleChange(e.target.value)}
                      />
                      <datalist id="feed-kol-handles">
                        {feedHandles.map((h) => (
                          <option key={h} value={h} />
                        ))}
                      </datalist>
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Display name</span>
                      <input
                        value={draft.displayName}
                        onChange={(e) => patchDraft('displayName', e.target.value)}
                      />
                    </label>
                    <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="admin-field-label">Text</span>
                      <textarea
                        rows={6}
                        value={draft.text}
                        onChange={(e) => patchDraft('text', e.target.value)}
                        style={{ whiteSpace: 'pre-wrap' }}
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Created at (ISO)</span>
                      <input
                        value={draft.createdAt}
                        onChange={(e) => patchDraft('createdAt', e.target.value)}
                        placeholder="2026-07-10T02:00:00Z"
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">URL</span>
                      <input
                        value={draft.url}
                        onChange={(e) => patchDraft('url', e.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Likes</span>
                      <input
                        type="number"
                        value={draft.likes}
                        onChange={(e) =>
                          patchDraft('likes', Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Reposts</span>
                      <input
                        type="number"
                        value={draft.reposts}
                        onChange={(e) =>
                          patchDraft('reposts', Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Replies</span>
                      <input
                        type="number"
                        value={draft.replies}
                        onChange={(e) =>
                          patchDraft('replies', Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Views</span>
                      <input
                        type="number"
                        value={draft.views}
                        onChange={(e) =>
                          patchDraft('views', Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label className="admin-field" style={{ gridColumn: '1 / -1' }}>
                      <span className="admin-field-label">
                        Media URLs (mỗi dòng 1 URL)
                      </span>
                      <textarea
                        rows={3}
                        value={mediaText}
                        onChange={(e) =>
                          patchDraft(
                            'media',
                            e.target.value
                              .split(/[\n,]/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Is reply</span>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={draft.isReply}
                          onChange={(e) => patchDraft('isReply', e.target.checked)}
                        />
                        Reply
                      </label>
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Avatar path</span>
                      <input
                        value={draft.avatarLocal}
                        onChange={(e) => patchDraft('avatarLocal', e.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <p className="admin-hint">
                  <strong>Save (R2)</strong> = publish feed cho mọi visitor. Cần
                  token khớp <code>FEED_ADMIN_TOKEN</code>. Không còn Save
                  local-only.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
