import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FeedPost, Tier1Feed } from '../types/feed'
import type { Kol } from '../types'
import {
  clearFeedStore,
  createEmptyPost,
  exportFeedJson,
  fetchSeedFeed,
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
    const q = query.trim().toLowerCase()
    let list = sortPostsLatest(feed.posts)
    if (q) {
      list = list.filter(
        (p) =>
          p.handle.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q),
      )
    }
    return list
  }, [feed, query])

  const tier1Handles = useMemo(
    () =>
      kols
        .filter((k) => k.tier === 1 && !k.hidden)
        .sort((a, b) => b.score - a.score)
        .map((k) => k.handle),
    [kols],
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
    setSavingServer(true)
    // Always mirror local first
    const local = saveFeedLocal(next, 'before server')
    setFeed(local)
    const result = await saveFeedToServer(local, 'admin save')
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
      onToast(`Server lỗi: ${result.error}`)
    }
  }

  const onSaveToken = () => {
    setAdminToken(tokenInput)
    onToast(tokenInput.trim() ? 'Đã lưu admin token (local)' : 'Đã xóa token')
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
      const handle = tier1Handles[0] || 'new_handle'
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
  }, [kols, onToast, tier1Handles])

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
      ? 'Server (KV)'
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
        <strong>Tier 1 Feed</strong>
        <span>
          Nguồn load:{' '}
          <strong>{sourceLabel}</strong>
          {feed ? ` · ${feed.postCount} posts · ${feed.kolCount} voices` : ''}.
          Ưu tiên: <em>Server KV</em> → local → seed. Sau khi cấu hình Vercel KV
          + token, bấm <strong>Save to server</strong> để mọi user thấy cùng feed.
          Xem <code>docs/FEED_SERVER.md</code>.
        </span>
      </div>

      <div className="admin-feed-toolbar glass">
        <label className="admin-feed-token">
          <span>Server token</span>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="FEED_ADMIN_TOKEN"
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
              <input
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter posts…"
              />
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
                  <p>Chưa có post</p>
                  <button type="button" className="btn btn--primary" onClick={onAdd}>
                    + Add post
                  </button>
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
                        list="tier1-handles"
                        value={draft.handle}
                        onChange={(e) => onHandleChange(e.target.value)}
                      />
                      <datalist id="tier1-handles">
                        {tier1Handles.map((h) => (
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
