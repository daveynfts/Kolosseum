import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FeedPost, Tier1Feed } from '../types/feed'
import type { Kol } from '../types'
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

interface Props {
  kols: Kol[]
  onToast: (msg: string) => void
  /** Increment from parent header to force-create a post */
  addSignal?: number
}

export function AdminFeedEditor({ kols, onToast, addSignal = 0 }: Props) {
  const [feed, setFeed] = useState<Tier1Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingServer, setSavingServer] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<FeedPost | null>(null)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState('')
  const [feedSource, setFeedSource] = useState<FeedSource | 'unknown'>('unknown')
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const [isOverride, setIsOverride] = useState(() => hasFeedOverride())
  const [xUrl, setXUrl] = useState('')
  const [fetchingX, setFetchingX] = useState(false)
  const [lastFetchNote, setLastFetchNote] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { feed: data, source } = await loadFeedWithSource()
      setFeed(data)
      setFeedSource(source)
      setIsOverride(hasFeedOverride())
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Load feed failed')
      setFeed({
        generatedAt: new Date().toISOString(),
        source: 'admin',
        mode: 'admin',
        tier: 1,
        kolCount: 0,
        handles: [],
        postCount: 0,
        posts: [],
      })
      setFeedSource('local')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

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

  /** T1 + T2 handles for feed authorship */
  const feedHandles = useMemo(
    () =>
      kols
        .filter((k) => !k.hidden && (k.tier === 1 || k.tier === 2))
        .sort(
          (a, b) =>
            (a.tier ?? 3) - (b.tier ?? 3) ||
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
  const archivedCount = feed?.archivedCount ?? feed?.archivedPosts?.length ?? 0

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

  const persistLocal = (next: Tier1Feed, note?: string) => {
    const saved = saveFeedLocal(next, note)
    setFeed(saved)
    setFeedSource('local')
    setIsOverride(true)
    setDirty(false)
    onToast('Đã lưu local (browser)')
    return saved
  }

  const onSaveDraft = () => {
    const next = buildFeedWithDraft()
    if (!next || !draft) return
    const saved = persistLocal(next, 'edit post')
    const fixed = saved.posts.find((p) => p.id === draft.id) || draft
    setSelectedId(fixed.id)
    setDraft(fixed)
  }

  const onSaveServer = async () => {
    const next = buildFeedWithDraft() || feed
    if (!next) {
      onToast('Chưa có feed để lưu')
      return
    }
    // Always use token currently in the input (not only previously saved)
    const token = tokenInput.trim()
    if (!token) {
      onToast('Nhập Server token (= FEED_ADMIN_TOKEN trên Vercel) rồi Save to server')
      return
    }
    setAdminToken(token)
    setSavingServer(true)
    // Always mirror local first
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
      onToast('Đã lưu lên server — mọi user sẽ thấy feed này')
    } else {
      const hint =
        result.status === 401
          ? ' — Token sai hoặc khác FEED_ADMIN_TOKEN (Production). Không dùng Redis token.'
          : ''
      onToast(`Server lỗi: ${result.error}${hint}`)
    }
  }

  const onSaveToken = () => {
    setAdminToken(tokenInput)
    onToast(
      tokenInput.trim()
        ? 'Đã lưu admin token (local) — giờ bấm Save to server'
        : 'Đã xóa token',
    )
  }

  const onFetchXUrl = async () => {
    const url = xUrl.trim()
    if (!url) {
      onToast('Dán URL bài X (x.com/.../status/...)')
      return
    }
    const token = tokenInput.trim()
    if (token) setAdminToken(token)
    setFetchingX(true)
    setLastFetchNote(null)
    const result = await fetchXStatusFromUrl(url, token || undefined)
    setFetchingX(false)
    if (!result.ok) {
      onToast(`Fetch X lỗi: ${result.error}`)
      return
    }
    const p = result.post
    // Keep existing draft id if editing; else new id from tweet
    const merged: FeedPost = normalizePost({
      ...(draft || {}),
      id: draft?.id || p.id,
      handle: p.handle,
      displayName: p.displayName,
      text: p.text,
      createdAt: p.createdAt,
      likes: p.likes,
      reposts: p.reposts,
      replies: p.replies,
      views: p.views,
      media: p.media,
      isReply: p.isReply,
      url: p.url,
      avatarLocal: p.avatarLocal,
    })

    // Ensure post is in feed list
    setFeed((prev) => {
      const base = prev ?? {
        generatedAt: new Date().toISOString(),
        source: 'admin',
        mode: 'admin',
        tier: 1,
        kolCount: 0,
        handles: [],
        postCount: 0,
        posts: [],
      }
      const exists = base.posts.some((x) => x.id === merged.id)
      const posts = exists
        ? base.posts.map((x) => (x.id === merged.id ? merged : x))
        : [merged, ...base.posts]
      return { ...base, posts }
    })
    setSelectedId(merged.id)
    setDraft(merged)
    setDirty(true)
    setLoading(false)

    const cached = result.cache?.imagesCached ?? 0
    const total = result.cache?.imagesTotal ?? p.media?.length ?? 0
    const note =
      total > 0
        ? `Đã fetch @${p.handle} · ảnh cache ${cached}/${total} (snapshot lúc ${new Date().toLocaleTimeString('vi-VN')})`
        : `Đã fetch @${p.handle} · không có ảnh · snapshot ${new Date().toLocaleTimeString('vi-VN')}`
    setLastFetchNote(note)
    onToast(note)
  }

  const emptyFeed = (): Tier1Feed => ({
    generatedAt: new Date().toISOString(),
    source: 'admin',
    mode: 'admin',
    tier: 1,
    kolCount: 0,
    handles: [],
    postCount: 0,
    posts: [],
  })

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
        `Archive ${n} post cũ hơn 1 tuần? Chúng sẽ ra khỏi X Feed live (vẫn giữ trong archivedPosts).`,
      )
    ) {
      return
    }
    const { feed: next, moved } = archiveOldPosts(feed)
    persistLocal(next, `archive ${moved} posts >7d`)
    if (draft && !next.posts.some((p) => p.id === draft.id)) {
      setSelectedId(null)
      setDraft(null)
    }
    onToast(`Đã archive ${moved} post · archive total ${next.archivedCount ?? 0}`)
  }

  // Parent header "+ Add post" signal
  useEffect(() => {
    if (addSignal > 0) onAdd()
  }, [addSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDelete = () => {
    if (!feed || !draft) return
    if (!confirm(`Xóa post của @${draft.handle}?`)) return
    const posts = feed.posts.filter((p) => p.id !== draft.id)
    persistLocal({ ...feed, posts }, 'delete post')
    setSelectedId(null)
    setDraft(null)
  }

  const onResetSeed = async () => {
    if (!confirm('Reset Feed về seed tier1-feed.json (xóa override localStorage)?'))
      return
    clearFeedStore()
    try {
      const seed = await fetchSeedFeed()
      setFeed(seed)
      setSelectedId(null)
      setDraft(null)
      setDirty(false)
      setIsOverride(false)
      setFeedSource('seed')
      onToast('Đã reset local về seed (server không đổi)')
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
      persistLocal(data, 'import')
      setSelectedId(null)
      setDraft(null)
      onToast(`Imported ${data.posts.length} posts (local)`)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const sourceLabel =
    feedSource === 'server'
      ? 'Server (R2)'
      : feedSource === 'local'
        ? 'Local browser'
        : feedSource === 'seed'
          ? 'Seed JSON'
          : '…'

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

  return (
    <div className="admin-feed">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>X Feed (Tier 1 + Tier 2)</strong>
        <span>
          Nguồn load:{' '}
          <strong>{sourceLabel}</strong>
          {feed
            ? ` · ${feed.postCount} live · ${archivedCount} archived · ${feed.kolCount} voices`
            : ''}
          . Ưu tiên: <em>Cloudflare R2</em> → local → seed. Post &gt; 7 ngày →
          bấm <strong>Archive &gt;7d</strong>. Save to server để user thấy.
        </span>
      </div>

      <div className="admin-feed-toolbar glass admin-feed-fetch-row">
        <label className="admin-feed-token admin-feed-xurl">
          <span>Dán URL bài X → Fetch (snapshot + cache ảnh)</span>
          <input
            type="url"
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            placeholder="https://x.com/user/status/1234567890"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onFetchXUrl()
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onFetchXUrl()}
          disabled={fetchingX}
        >
          {fetchingX ? 'Fetching…' : 'Fetch từ X'}
        </button>
        {lastFetchNote && (
          <span className="admin-count" style={{ alignSelf: 'center' }}>
            {lastFetchNote}
          </span>
        )}
      </div>

      <div className="admin-feed-toolbar glass">
        <label className="admin-feed-token">
          <span>Server token (= FEED_ADMIN_TOKEN, không phải Redis)</span>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="dán FEED_ADMIN_TOKEN từ Vercel"
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn" onClick={onSaveToken}>
          Save token
        </button>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          + Add post
        </button>
        <button
          type="button"
          className="btn"
          onClick={onArchiveOld}
          disabled={!feed || archivableCount === 0}
          title="Chuyển post cũ hơn 7 ngày sang archivedPosts"
        >
          Archive &gt;7d{archivableCount > 0 ? ` (${archivableCount})` : ''}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSaveServer()}
          disabled={savingServer || !feed}
        >
          {savingServer ? 'Saving…' : 'Save to server'}
        </button>
        <button type="button" className="btn" onClick={onExport} disabled={!feed}>
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
        <button type="button" className="btn btn--danger" onClick={() => void onResetSeed()}>
          Reset local
        </button>
        <button type="button" className="btn" onClick={() => void refresh()}>
          Reload
        </button>
        <span className="admin-count" style={{ alignSelf: 'center' }}>
          {sourceLabel}
          {isOverride ? ' · local cache' : ''}
        </span>
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
          <div className="admin-edit-side glass">
            <div className="admin-side-list-head">
              <strong>Posts ({filtered.length})</strong>
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                + Add
              </button>
            </div>
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
                  placeholder="Tìm @handle, nội dung…"
                  aria-label="Filter posts"
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
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`admin-side-item ${selectedId === p.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
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
                    <button type="button" className="btn" onClick={onSaveDraft}>
                      Save local
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void onSaveServer()}
                      disabled={savingServer}
                    >
                      {savingServer ? 'Saving…' : 'Save to server'}
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
                  <strong>Save local</strong> = browser này.{' '}
                  <strong>Save to server</strong> = Vercel KV (mọi user). Cần dán
                  token khớp env <code>FEED_ADMIN_TOKEN</code>. Map load server
                  trước, rồi local, rồi seed.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
