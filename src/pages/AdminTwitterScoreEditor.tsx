/**
 * Admin tab: internal TwitterScore Top N dataset.
 * Full-width editor for benchmark accounts — expandable detail fields.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  recomputeTwitterScoreStats,
  searchTwitterScoreTop100,
  type TwitterScoreAccount,
  type TwitterScoreDataset,
} from '../data/twitterScoreTop100'
import {
  clearTwitterScoreCache,
  exportTwitterScoreJson,
  importTwitterScoreJson,
  loadTwitterScoreWithSource,
  saveTwitterScoreToServer,
  seedTwitterScoreDataset,
} from '../lib/twitterScoreStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import { XProfileAvatar } from '../components/XProfileAvatar'

interface Props {
  onToast: (msg: string) => void
}

/** Extended detail fields (optional) — stored on each account for future analysis */
export type TwitterScoreAccountDetail = TwitterScoreAccount & {
  role?: string
  category?: string
  notes?: string
  tags?: string
  website?: string
  lastReviewedAt?: string
}

function asDetail(a: TwitterScoreAccount): TwitterScoreAccountDetail {
  return a as TwitterScoreAccountDetail
}

export function AdminTwitterScoreEditor({ onToast }: Props) {
  const [dataset, setDataset] = useState<TwitterScoreDataset>(() =>
    seedTwitterScoreDataset(),
  )
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [query, setQuery] = useState('')
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())

  useEffect(() => {
    let cancelled = false
    void loadTwitterScoreWithSource().then((r) => {
      if (cancelled) return
      setDataset(r.dataset)
      setSource(r.source)
      if (!selectedHandle && r.dataset.accounts[0]) {
        setSelectedHandle(r.dataset.accounts[0].handle)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = useMemo(
    () => searchTwitterScoreTop100(query, dataset.accounts),
    [query, dataset.accounts],
  )

  const selected = useMemo(() => {
    if (!selectedHandle) return null
    return (
      dataset.accounts.find(
        (a) => a.handle.toLowerCase() === selectedHandle.toLowerCase(),
      ) || null
    )
  }, [dataset.accounts, selectedHandle])

  const selectedDetail = selected ? asDetail(selected) : null

  const patchSelected = (patch: Partial<TwitterScoreAccountDetail>) => {
    if (!selectedHandle) return
    setDataset((prev) => {
      const accounts = prev.accounts.map((a) => {
        if (a.handle.toLowerCase() !== selectedHandle.toLowerCase()) return a
        const next = { ...asDetail(a), ...patch }
        if (patch.handle != null) {
          next.handle = String(patch.handle).replace(/^@/, '').trim()
        }
        if (patch.score != null) {
          next.score = Number(patch.score) || 0
        }
        return next
      })
      // If handle renamed, update selection
      if (patch.handle) {
        const h = String(patch.handle).replace(/^@/, '').trim()
        queueMicrotask(() => setSelectedHandle(h))
      }
      return recomputeTwitterScoreStats({ ...prev, accounts })
    })
    setDirty(true)
  }

  const onAdd = () => {
    const handle = `account_${Date.now().toString(36).slice(-5)}`
    setDataset((prev) =>
      recomputeTwitterScoreStats({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            rank: prev.accounts.length + 1,
            handle,
            displayName: 'New account',
            score: prev.top200Threshold || prev.top100Threshold || 500,
            role: '',
            category: '',
            notes: '',
            tags: '',
          } as TwitterScoreAccountDetail,
        ],
      }),
    )
    setSelectedHandle(handle)
    setQuery(handle)
    setDirty(true)
  }

  const onRemove = () => {
    if (!selectedHandle) return
    if (!confirm(`Xóa @${selectedHandle} khỏi list?`)) return
    setDataset((prev) =>
      recomputeTwitterScoreStats({
        ...prev,
        accounts: prev.accounts.filter(
          (a) => a.handle.toLowerCase() !== selectedHandle.toLowerCase(),
        ),
      }),
    )
    setSelectedHandle(null)
    setDirty(true)
  }

  const onSave = async () => {
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN rồi Save (R2)')
      return
    }
    setAdminToken(token)
    setSaving(true)
    const result = await saveTwitterScoreToServer(
      {
        ...dataset,
        asOf: dataset.asOf || new Date().toISOString(),
        note: dataset.note || 'admin TwitterScore internal data',
      },
      'admin tab TwitterScore',
      token,
    )
    setSaving(false)
    if (!result.ok) {
      onToast(`Publish thất bại: ${result.error}`)
      return
    }
    setDataset(result.dataset)
    setSource('server')
    setDirty(false)
    onToast(
      `Đã publish TwitterScore Top ${result.dataset.accounts.length} → R2`,
    )
  }

  const onReload = () => {
    void loadTwitterScoreWithSource().then((r) => {
      setDataset(r.dataset)
      setSource(r.source)
      setDirty(false)
      onToast(`Reloaded from ${r.source}`)
    })
  }

  const onResetSeed = () => {
    if (!confirm('Reset về seed JSON trong repo?')) return
    clearTwitterScoreCache()
    const seed = seedTwitterScoreDataset()
    setDataset(seed)
    setSource('seed')
    setDirty(true)
    onToast('Seed loaded — Save (R2) để publish')
  }

  const onExport = () => {
    const blob = new Blob([exportTwitterScoreJson(dataset)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `twitterscore-top${dataset.accounts.length}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported JSON → commit data/internal/ nếu cập nhật seed')
  }

  const onImport = async (file: File) => {
    try {
      const imported = importTwitterScoreJson(await file.text())
      setDataset(imported)
      setSource('seed')
      setDirty(true)
      onToast(`Imported ${imported.accounts.length} accounts`)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  return (
    <div className="admin-feed admin-ts-page">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>TwitterScore · data nội bộ</strong>
        <span>
          Benchmark Web3 network influence (0–1000). Source:{' '}
          <strong>{source}</strong>
          {dirty ? ' · unsaved' : ''} · {dataset.accounts.length} accounts ·
          asOf {dataset.asOf.slice(0, 10)} · #100≥{dataset.top100Threshold}
          {dataset.top200Threshold != null
            ? ` · floor ${dataset.top200Threshold}`
            : ''}
          . Seed <code>data/internal/twitterscore-top100.json</code> · R2{' '}
          <code>internal/twitterscore-top100/v1.json</code>. Có thể bổ sung
          role / notes / tags chi tiết từng account.
        </span>
        <label className="admin-token-row">
          Token
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="FEED_ADMIN_TOKEN"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="admin-feed-toolbar glass">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSave()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button type="button" className="btn" onClick={onAdd}>
          + Add account
        </button>
        <button type="button" className="btn" onClick={onExport}>
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
        <button type="button" className="btn" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn btn--danger" onClick={onResetSeed}>
          Reset seed
        </button>
        <span className="admin-count" style={{ alignSelf: 'center' }}>
          mean {Number(dataset.mean).toFixed(1)} · median {dataset.median} · at
          max {dataset.atMax}
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-edit-layout admin-ts-layout">
        {/* List */}
        <div className="admin-edit-side glass admin-ts-list-col">
          <div className="admin-side-list-head">
            <strong>Accounts ({list.length})</strong>
          </div>
          <div className="admin-toolbar" style={{ margin: '0 10px 4px' }}>
            <label className="admin-search-wrap">
              <span className="admin-search-wrap__icon" aria-hidden>
                ⌕
              </span>
              <input
                type="text"
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm #rank, @handle, tên, điểm…"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="admin-search-wrap__clear"
                  onClick={() => setQuery('')}
                >
                  ×
                </button>
              )}
            </label>
          </div>
          <ul className="admin-side-list admin-ts-list">
            {list.map((acc) => {
              const active =
                selectedHandle?.toLowerCase() === acc.handle.toLowerCase()
              return (
                <li key={`${acc.rank}-${acc.handle}`}>
                  <button
                    type="button"
                    className={`admin-ts-list-item ${active ? 'is-active' : ''}`}
                    onClick={() => setSelectedHandle(acc.handle)}
                  >
                    <span className="admin-ts-row__rank">#{acc.rank}</span>
                    <XProfileAvatar
                      handle={acc.handle}
                      name={acc.displayName}
                      size={32}
                    />
                    <span className="admin-ts-row__meta">
                      <strong>{acc.displayName}</strong>
                      <small>@{acc.handle}</small>
                    </span>
                    <span
                      className={`admin-ts-row__score ${acc.score >= 1000 ? 'is-max' : ''}`}
                    >
                      {acc.score}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Detail editor — room for future fields */}
        <div className="admin-edit-main glass admin-ts-detail">
          {!selectedDetail ? (
            <p className="muted">Chọn account bên trái để xem / chỉnh chi tiết.</p>
          ) : (
            <>
              <div className="admin-ts-detail__head">
                <XProfileAvatar
                  handle={selectedDetail.handle}
                  name={selectedDetail.displayName}
                  size={56}
                />
                <div>
                  <h2>
                    #{selectedDetail.rank} · {selectedDetail.displayName}
                  </h2>
                  <p className="muted">
                    @{selectedDetail.handle} · TwitterScore{' '}
                    <strong>{selectedDetail.score}</strong>/1000
                  </p>
                  <a
                    className="admin-ts-xlink"
                    href={`https://x.com/${selectedDetail.handle}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on X ↗
                  </a>
                </div>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={onRemove}
                >
                  Delete
                </button>
              </div>

              <section className="admin-ts-section">
                <h3>Identity</h3>
                <div className="admin-ts-fields">
                  <label>
                    Display name
                    <input
                      value={selectedDetail.displayName}
                      onChange={(e) =>
                        patchSelected({ displayName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Handle
                    <input
                      value={selectedDetail.handle}
                      onChange={(e) =>
                        patchSelected({
                          handle: e.target.value.replace(/^@/, ''),
                        })
                      }
                    />
                  </label>
                  <label>
                    TwitterScore (0–1000)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={selectedDetail.score}
                      onChange={(e) =>
                        patchSelected({
                          score: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    Rank (auto after recompute)
                    <input type="number" value={selectedDetail.rank} disabled />
                  </label>
                </div>
              </section>

              <section className="admin-ts-section">
                <h3>Chi tiết (bổ sung dần)</h3>
                <div className="admin-ts-fields">
                  <label>
                    Role / title
                    <input
                      value={selectedDetail.role || ''}
                      onChange={(e) => patchSelected({ role: e.target.value })}
                      placeholder="Founder, VC, KOL, Media…"
                    />
                  </label>
                  <label>
                    Category
                    <input
                      value={selectedDetail.category || ''}
                      onChange={(e) =>
                        patchSelected({ category: e.target.value })
                      }
                      placeholder="infra · VC · exchange · AI · media"
                    />
                  </label>
                  <label>
                    Tags (comma-separated)
                    <input
                      value={selectedDetail.tags || ''}
                      onChange={(e) => patchSelected({ tags: e.target.value })}
                      placeholder="ethereum, defi, research"
                    />
                  </label>
                  <label>
                    Website / link
                    <input
                      value={selectedDetail.website || ''}
                      onChange={(e) =>
                        patchSelected({ website: e.target.value })
                      }
                      placeholder="https://"
                    />
                  </label>
                  <label className="admin-ts-fields--full">
                    Notes / admin analysis
                    <textarea
                      rows={6}
                      value={selectedDetail.notes || ''}
                      onChange={(e) =>
                        patchSelected({ notes: e.target.value })
                      }
                      placeholder="Ghi chú nội bộ: COI, narrative, liên hệ KOL VN, lý do theo dõi…"
                    />
                  </label>
                  <label>
                    Last reviewed (ISO)
                    <input
                      value={selectedDetail.lastReviewedAt || ''}
                      onChange={(e) =>
                        patchSelected({
                          lastReviewedAt: e.target.value || undefined,
                        })
                      }
                      placeholder="2026-07-17"
                    />
                  </label>
                </div>
              </section>

              {dirty && (
                <div className="admin-ts-detail__footer">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void onSave()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save all (R2)'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
