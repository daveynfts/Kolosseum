/**
 * Admin: SCEX tracking config, actors, livefeed posts, matrix preview.
 * All fields editable → Save R2 for partner-facing view.
 */
import { useMemo, useState } from 'react'
import {
  actorMatrixPos,
  actorPassesThresholds,
  actorSizeValue,
  actorVolumeMetric,
  createEmptyActor,
  createEmptyPost,
  defaultScexScoring,
  recomputeScexScores,
  type ScexActor,
  type ScexConfig,
  type ScexDataset,
  type ScexPost,
  type ScexQuadrant,
  type ScexRadarPipeline,
  type ScexScoringConfig,
  type ScexSentiment,
} from '../data/scexTracking'
import { xAvatarUrl } from '../lib/avatar'
import {
  clearScexCache,
  exportScexJson,
  importScexJson,
  loadScexWithSource,
  saveScexToServer,
  seedScexDataset,
} from '../lib/scexStore'
import { loadKolsWithSource } from '../lib/kolStore'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import { XProfileAvatar } from '../components/XProfileAvatar'
import { getKolRank } from '../types'
import {
  confirmDiscardUnsaved,
  useDirtyRef,
  useRegisterAdminOps,
  useRemoteDatasetLoad,
} from '../lib/adminLoadGuard'
import { safeHref } from '../lib/safeUrl'

interface Props {
  onToast: (msg: string) => void
}

type SubTab = 'settings' | 'actors' | 'posts' | 'pipeline' | 'preview'

const SENTIMENTS: ScexSentiment[] = [
  'bullish',
  'bearish',
  'shill',
  'scam',
  'neutral',
]
const QUADRANTS: ScexQuadrant[] = ['stars', 'nurture', 'noise', 'ignore']
const RADAR_PIPELINES: ScexRadarPipeline[] = [
  'none',
  'candidate',
  'review',
  'promoted',
  'rejected',
]

function scexHandleKey(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

export function AdminScexEditor({ onToast }: Props) {
  const [dataset, setDataset] = useState<ScexDataset>(() => seedScexDataset())
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [sub, setSub] = useState<SubTab>('pipeline')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useDirtyRef(dirty)
  const [saving, setSaving] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [actorQuery, setActorQuery] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState<
    'all' | ScexRadarPipeline | 'needs_avatar'
  >('candidate')

  useRemoteDatasetLoad(
    () => loadScexWithSource({ includeHidden: true }),
    dirtyRef,
    (r) => {
    setDataset(r.dataset)
    setSource(r.source)
    if (!selectedActorId && r.dataset.actors[0]) {
      setSelectedActorId(r.dataset.actors[0].id)
    }
    if (!selectedPostId && r.dataset.posts[0]) {
      setSelectedPostId(r.dataset.posts[0].id)
    }
  })

  const config = dataset.config

  const patchConfig = (patch: Partial<ScexConfig>) => {
    setDataset((prev) =>
      recomputeScexScores({
        ...prev,
        config: { ...prev.config, ...patch },
      }),
    )
    setDirty(true)
  }

  const patchScoring = (patch: Partial<ScexScoringConfig>) => {
    setDataset((prev) => {
      const base = defaultScexScoring()
      const cur = { ...base, ...(prev.config.scoring || {}) }
      const next: ScexScoringConfig = {
        ...cur,
        ...patch,
        mapTierScores: {
          ...base.mapTierScores,
          ...cur.mapTierScores,
          ...(patch.mapTierScores || {}),
        },
        sentimentScores: {
          ...base.sentimentScores,
          ...cur.sentimentScores,
          ...(patch.sentimentScores || {}),
        },
      }
      return recomputeScexScores({
        ...prev,
        config: { ...prev.config, scoring: next },
      })
    })
    setDirty(true)
  }

  const recomputeScores = async () => {
    try {
      const { kols } = await loadKolsWithSource()
      const mapInputs = kols.map((k) => ({
        handle: k.handle,
        rank: getKolRank(k),
        tier: k.tier,
        score: k.score,
      }))
      setDataset((prev) => {
        const scoringCfg = {
          ...defaultScexScoring(),
          ...(prev.config.scoring || {}),
          mapTierScores: {
            ...defaultScexScoring().mapTierScores,
            ...(prev.config.scoring?.mapTierScores || {}),
          },
          sentimentScores: {
            ...defaultScexScoring().sentimentScores,
            ...(prev.config.scoring?.sentimentScores || {}),
          },
        }
        const ds = recomputeScexScores(
          {
            ...prev,
            config: {
              ...prev.config,
              scoring: scoringCfg,
              volumeAxis: {
                min: 0,
                max: 100,
                label:
                  prev.config.volumeAxis?.label || 'Tần suất mention',
              },
              qualityAxis: {
                min: 0,
                max: 100,
                label: prev.config.qualityAxis?.label || 'Chất lượng',
              },
              volumeSplit:
                prev.config.volumeSplit > 20 ? prev.config.volumeSplit : 42,
              qualitySplit: prev.config.qualitySplit ?? 55,
            },
          },
          mapInputs,
        )
        return ds
      })
      setDirty(true)
      onToast(
        `Đã recompute scores (${kols.length} map KOLs). Save R2 để public nhận.`,
      )
    } catch (e) {
      onToast(
        `Recompute lỗi: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  const scoring = {
    ...defaultScexScoring(),
    ...(config.scoring || {}),
  }

  const selectedActor = useMemo(
    () => dataset.actors.find((a) => a.id === selectedActorId) || null,
    [dataset.actors, selectedActorId],
  )

  const selectedPost = useMemo(
    () => dataset.posts.find((p) => p.id === selectedPostId) || null,
    [dataset.posts, selectedPostId],
  )

  const actorsByHandle = useMemo(() => {
    const m = new Map<string, ScexActor>()
    for (const a of dataset.actors) {
      const key = scexHandleKey(a.handle)
      if (key) m.set(key, a)
    }
    return m
  }, [dataset.actors])

  const filteredActors = useMemo(() => {
    const q = actorQuery.trim().toLowerCase()
    let list = dataset.actors
    if (q) {
      list = list.filter(
        (a) =>
          a.handle.includes(q) ||
          a.displayName.toLowerCase().includes(q) ||
          (a.tier || '').toLowerCase().includes(q) ||
          (a.notes || '').toLowerCase().includes(q) ||
          (a.radarPipeline || '').includes(q) ||
          (a.tags || '').toLowerCase().includes(q),
      )
    }
    return [...list].sort(
      (a, b) =>
        b.qualityScore - a.qualityScore ||
        (b.volumeScore ?? b.postsVolume) - (a.volumeScore ?? a.postsVolume),
    )
  }, [dataset.actors, actorQuery])

  const pipelineActors = useMemo(() => {
    let list = dataset.actors
    if (pipelineFilter === 'needs_avatar') {
      list = list.filter((a) => !a.avatarWarmedAt && !a.avatarUrl)
    } else if (pipelineFilter !== 'all') {
      list = list.filter(
        (a) => (a.radarPipeline || 'none') === pipelineFilter,
      )
    }
    return [...list].sort(
      (a, b) =>
        (b.followers || 0) - (a.followers || 0) ||
        b.qualityScore - a.qualityScore,
    )
  }, [dataset.actors, pipelineFilter])

  const pipelineCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: dataset.actors.length,
      none: 0,
      candidate: 0,
      review: 0,
      promoted: 0,
      rejected: 0,
      needs_avatar: 0,
    }
    for (const a of dataset.actors) {
      const p = a.radarPipeline || 'none'
      c[p] = (c[p] || 0) + 1
      if (!a.avatarWarmedAt && !a.avatarUrl) c.needs_avatar++
    }
    return c
  }, [dataset.actors])

  const exportRadarCandidates = () => {
    const rows = dataset.actors
      .filter(
        (a) =>
          a.radarPipeline === 'candidate' || a.radarPipeline === 'review',
      )
      .map((a) => ({
        handle: a.handle,
        displayName: a.displayName,
        followers: a.followers,
        postsVolume: a.postsVolume,
        volumeScore: a.volumeScore,
        qualityScore: a.qualityScore,
        sentiment: a.sentiment,
        quadrant: a.quadrant,
        mapRank: a.mapRank || null,
        radarPipeline: a.radarPipeline,
        radarNote: a.radarNote || '',
        avatarUrl: a.avatarUrl || xAvatarUrl(a.handle),
        avatarWarmedAt: a.avatarWarmedAt || null,
        sourcedAt: a.sourcedAt || null,
        tags: a.tags || '',
        notes: a.notes || '',
        lastPostAt: a.lastPostAt || null,
        samplePosts: dataset.posts
          .filter((p) => p.handle === a.handle)
          .slice(0, 5)
          .map((p) => ({
            url: p.url,
            postedAt: p.postedAt,
            text: (p.text || '').slice(0, 160),
            sentiment: p.sentiment,
          })),
      }))
    const blob = new Blob(
      [
        JSON.stringify(
          {
            kind: 'scex-radar-pipeline',
            exportedAt: new Date().toISOString(),
            count: rows.length,
            accounts: rows,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scex-radar-candidates-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast(`Exported ${rows.length} Radar pipeline accounts`)
  }

  const patchActor = (id: string, patch: Partial<ScexActor>) => {
    setDataset((prev) => {
      const actors = prev.actors.map((a) => {
        if (a.id !== id) return a
        const next = { ...a, ...patch }
        if (patch.handle != null) {
          next.handle = String(patch.handle)
            .replace(/^@/, '')
            .trim()
            .toLowerCase()
        }
        return next
      })
      return recomputeScexScores({ ...prev, actors })
    })
    setDirty(true)
  }

  const patchPost = (id: string, patch: Partial<ScexPost>) => {
    setDataset((prev) => {
      const posts = prev.posts.map((p) => {
        if (p.id !== id) return p
        const next = { ...p, ...patch }
        if (patch.handle != null) {
          next.handle = String(patch.handle)
            .replace(/^@/, '')
            .trim()
            .toLowerCase()
        }
        return next
      })
      posts.sort(
        (a, b) =>
          new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      )
      return { ...prev, posts }
    })
    setDirty(true)
  }

  const onSave = async () => {
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops rồi Save (R2)')
      return
    }
    setAdminToken(token)
    setSaving(true)
    const r = await saveScexToServer(dataset, dataset.note, token)
    setSaving(false)
    if (r.ok) {
      setDataset(r.dataset)
      setSource('server')
      setDirty(false)
      onToast(
        `SCEX saved R2 · ${r.dataset.actors.length} actors · ${r.dataset.posts.length} posts`,
      )
    } else {
      onToast(`Save failed: ${r.error}`)
    }
  }

  const onReload = async () => {
    if (!confirmDiscardUnsaved(dirty)) return
    clearScexCache()
    const r = await loadScexWithSource({ includeHidden: true })
    setDataset(r.dataset)
    setSource(r.source)
    setDirty(false)
    onToast(`Reloaded (${r.source})`)
  }

  const onResetSeed = () => {
    if (!confirm('Reset SCEX data to seed? Unsaved R2 changes stay until Save.'))
      return
    setDataset(seedScexDataset())
    setSource('seed')
    setDirty(true)
    onToast('Reset to seed — Save (R2) to publish')
  }

  const onExport = () => {
    const blob = new Blob([exportScexJson(dataset)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scex-tracking-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported SCEX JSON')
  }

  const onImport = async (file: File) => {
    try {
      const imported = importScexJson(await file.text())
      setDataset(imported)
      setSource('seed')
      setDirty(true)
      onToast(
        `Imported ${imported.actors.length} actors · ${imported.posts.length} posts`,
      )
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const addActor = (kind: 'kol' | 'user') => {
    const a = createEmptyActor(kind)
    setDataset((prev) =>
      recomputeScexScores({ ...prev, actors: [...prev.actors, a] }),
    )
    setSelectedActorId(a.id)
    setDirty(true)
    setSub('actors')
  }

  const removeActor = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      actors: prev.actors.filter((a) => a.id !== id),
    }))
    if (selectedActorId === id) setSelectedActorId(null)
    setDirty(true)
  }

  const addPost = () => {
    const p = createEmptyPost(selectedActor?.handle || '')
    setDataset((prev) => ({ ...prev, posts: [p, ...prev.posts] }))
    setSelectedPostId(p.id)
    setDirty(true)
    setSub('posts')
  }

  const removePost = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== id),
    }))
    if (selectedPostId === id) setSelectedPostId(null)
    setDirty(true)
  }

  const visibleActors = useMemo(
    () => dataset.actors.filter((a) => actorPassesThresholds(a, config)),
    [dataset.actors, config],
  )

  const keywordsText = config.keywords.join(', ')

  useRegisterAdminOps('scex', {
    dirty,
    saving,
    source,
    updatedAt: dataset.updatedAt ?? null,
    save: () => void onSave(),
    reload: () => void onReload(),
  })

  return (
    <div className="admin-feed admin-scex-page">
      <div className="admin-ai-banner" style={{ marginBottom: 12 }}>
        <strong>SCEX Tracking</strong>
        <span>
          {dataset.actors.length} actors · {dataset.posts.length} posts · window{' '}
          {config.timeWindowDays}d · R2 <code>scex/tracking/v1.json</code> ·{' '}
          <a href="/scex">/scex</a>
        </span>
      </div>

      <div className="admin-feed-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSave()}
          disabled={saving || !dirty}
        >
          {saving ? 'Saving…' : 'Save (R2)'}
        </button>
        <button type="button" className="btn" onClick={() => void onReload()}>
          Reload
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
        <button type="button" className="btn btn--danger" onClick={onResetSeed}>
          Reset seed
        </button>
        <span className="admin-count" style={{ alignSelf: 'center' }}>
          Visible on matrix: {visibleActors.length}/{dataset.actors.length}
          {dirty ? ' · unsaved' : ''}
        </span>
      </div>

      <div className="admin-tabs admin-scex-subtabs">
        {(
          [
            ['settings', 'Settings'],
            ['actors', 'Actors'],
            ['pipeline', 'Pipeline'],
            ['posts', 'Livefeed'],
            ['preview', 'Preview'],
          ] as [SubTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`admin-tab ${sub === k ? 'is-active' : ''}`}
            onClick={() => setSub(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'settings' && (
        <details className="admin-scex-settings admin-section--fold" open>
          <summary>
            <h3>Settings</h3>
          </summary>
          <section className="admin-ts-section">
            <h3>Brand & keywords</h3>
            <div className="admin-ts-fields">
              <label>
                Brand name
                <input
                  value={config.brandName}
                  onChange={(e) => patchConfig({ brandName: e.target.value })}
                />
              </label>
              <label>
                Brand @handle
                <input
                  value={config.brandHandle}
                  onChange={(e) =>
                    patchConfig({
                      brandHandle: e.target.value.replace(/^@/, ''),
                    })
                  }
                />
              </label>
              <label className="admin-scex-span2">
                Keywords (comma-separated)
                <input
                  value={keywordsText}
                  onChange={(e) =>
                    patchConfig({
                      keywords: e.target.value
                        .split(/[,;\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="SCEX, @scex, scex.com"
                />
              </label>
              <label>
                Matrix title
                <input
                  value={config.matrixTitle}
                  onChange={(e) => patchConfig({ matrixTitle: e.target.value })}
                />
              </label>
              <label>
                Feed title
                <input
                  value={config.feedTitle}
                  onChange={(e) => patchConfig({ feedTitle: e.target.value })}
                />
              </label>
              <label className="admin-scex-check">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => patchConfig({ enabled: e.target.checked })}
                />
                Enabled (show on public /scex)
              </label>
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Time window & thresholds</h3>
            <div className="admin-ts-fields">
              <label>
                Window (days)
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={config.timeWindowDays}
                  onChange={(e) =>
                    patchConfig({
                      timeWindowDays: Number(e.target.value) || 7,
                    })
                  }
                />
              </label>
              <label>
                KOL min posts
                <input
                  type="number"
                  min={1}
                  value={config.kolMinPosts}
                  onChange={(e) =>
                    patchConfig({ kolMinPosts: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <label>
                User min posts
                <input
                  type="number"
                  min={1}
                  value={config.userMinPosts}
                  onChange={(e) =>
                    patchConfig({ userMinPosts: Number(e.target.value) || 3 })
                  }
                />
              </label>
              <label>
                User min followers
                <input
                  type="number"
                  min={0}
                  value={config.userMinFollowers}
                  onChange={(e) =>
                    patchConfig({
                      userMinFollowers: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                User min quality
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.userMinQuality}
                  onChange={(e) =>
                    patchConfig({
                      userMinQuality: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Matrix axes & splits (0–100)</h3>
            <p className="admin-ts-hint" style={{ opacity: 0.7, fontSize: 13 }}>
              X = volumeScore (log activity). Y = qualityScore. Split chia 4
              vùng TRỌNG ĐIỂM / TIỀM NĂNG / CẦN RÀ SOÁT / TÍN HIỆU YẾU.
            </p>
            <div className="admin-ts-fields">
              <label>
                Volume axis label
                <input
                  value={config.volumeAxis.label}
                  onChange={(e) =>
                    patchConfig({
                      volumeAxis: {
                        ...config.volumeAxis,
                        label: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Volume max (scale)
                <input
                  type="number"
                  min={1}
                  value={config.volumeAxis.max}
                  onChange={(e) =>
                    patchConfig({
                      volumeAxis: {
                        ...config.volumeAxis,
                        max: Number(e.target.value) || 100,
                      },
                    })
                  }
                />
              </label>
              <label>
                Volume split (X mid, 0–100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.volumeSplit}
                  onChange={(e) =>
                    patchConfig({
                      volumeSplit: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Quality axis label
                <input
                  value={config.qualityAxis.label}
                  onChange={(e) =>
                    patchConfig({
                      qualityAxis: {
                        ...config.qualityAxis,
                        label: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Quality split (Y mid 0–100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.qualitySplit}
                  onChange={(e) =>
                    patchConfig({
                      qualitySplit: Number(e.target.value) || 50,
                    })
                  }
                />
              </label>
              <label>
                Bubble size metric
                <select
                  value={config.sizeMetric}
                  onChange={(e) =>
                    patchConfig({
                      sizeMetric:
                        e.target.value === 'reach7d' ? 'reach7d' : 'followers',
                    })
                  }
                >
                  <option value="followers">Followers</option>
                  <option value="reach7d">Reach 7d</option>
                </select>
              </label>
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Scoring formula (matrix)</h3>
            <p className="admin-ts-hint" style={{ opacity: 0.7, fontSize: 13 }}>
              Volume = log(gốc × wGoc + reply × wReply). Quality = map tier +
              sentiment + depth + mild engagement. Map-verified KOLs get higher
              tier scores. Click <strong>Recompute scores</strong> after
              changing weights.
            </p>
            <div className="admin-ts-fields">
              <label>
                Vol: gốc weight
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={scoring.volGocWeight}
                  onChange={(e) =>
                    patchScoring({
                      volGocWeight: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Vol: reply weight
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={scoring.volReplyWeight}
                  onChange={(e) =>
                    patchScoring({
                      volReplyWeight: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Vol: log cap
                <input
                  type="number"
                  min={1}
                  value={scoring.volLogCap}
                  onChange={(e) =>
                    patchScoring({
                      volLogCap: Number(e.target.value) || 14,
                    })
                  }
                />
              </label>
              <label>
                Vol: views soft weight
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={scoring.volViewsSoftWeight}
                  onChange={(e) =>
                    patchScoring({
                      volViewsSoftWeight: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Vol: map boost
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scoring.volMapBoost}
                  onChange={(e) =>
                    patchScoring({
                      volMapBoost: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label>
                Q weight: map tier
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={scoring.wMapTier}
                  onChange={(e) =>
                    patchScoring({ wMapTier: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Q weight: sentiment
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={scoring.wSentiment}
                  onChange={(e) =>
                    patchScoring({ wSentiment: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Q weight: depth (gốc)
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={scoring.wDepth}
                  onChange={(e) =>
                    patchScoring({ wDepth: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Q weight: engagement (views)
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={scoring.wEngagement}
                  onChange={(e) =>
                    patchScoring({ wEngagement: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Use volumeScore on X
                <input
                  type="checkbox"
                  checked={scoring.useVolumeScore !== false}
                  onChange={(e) =>
                    patchScoring({ useVolumeScore: e.target.checked })
                  }
                />
              </label>
            </div>
            <h4 style={{ marginTop: 12, marginBottom: 8 }}>Map tier scores</h4>
            <div className="admin-ts-fields">
              {(
                [
                  'challenger',
                  'master',
                  'diamond',
                  'platinum',
                  'gold',
                  'none',
                ] as const
              ).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoring.mapTierScores[k]}
                    onChange={(e) =>
                      patchScoring({
                        mapTierScores: {
                          ...scoring.mapTierScores,
                          [k]: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => void recomputeScores()}
              >
                Recompute scores (map ranks)
              </button>
              <span style={{ fontSize: 12, opacity: 0.65, alignSelf: 'center' }}>
                Ghi scoreLog trên từng actor · nhớ Save R2
              </span>
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Quadrant labels</h3>
            <div className="admin-scex-quad-grid">
              {QUADRANTS.map((q) => (
                <div key={q} className="admin-scex-quad-card glass">
                  <code>{q}</code>
                  <label>
                    Title
                    <input
                      value={config.quadrantLabels[q]?.title || ''}
                      onChange={(e) =>
                        patchConfig({
                          quadrantLabels: {
                            ...config.quadrantLabels,
                            [q]: {
                              ...config.quadrantLabels[q],
                              title: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Subtitle
                    <input
                      value={config.quadrantLabels[q]?.subtitle || ''}
                      onChange={(e) =>
                        patchConfig({
                          quadrantLabels: {
                            ...config.quadrantLabels,
                            [q]: {
                              ...config.quadrantLabels[q],
                              subtitle: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Sentiment badges</h3>
            <div className="admin-scex-sent-grid">
              {SENTIMENTS.map((s) => (
                <div key={s} className="admin-scex-sent-row">
                  <span
                    className="admin-scex-sent-swatch"
                    style={{
                      background: config.sentimentLabels[s]?.color || '#888',
                    }}
                  />
                  <code>{s}</code>
                  <input
                    value={config.sentimentLabels[s]?.label || ''}
                    onChange={(e) =>
                      patchConfig({
                        sentimentLabels: {
                          ...config.sentimentLabels,
                          [s]: {
                            ...config.sentimentLabels[s],
                            label: e.target.value,
                          },
                        },
                      })
                    }
                  />
                  <input
                    type="color"
                    value={config.sentimentLabels[s]?.color || '#888888'}
                    onChange={(e) =>
                      patchConfig({
                        sentimentLabels: {
                          ...config.sentimentLabels,
                          [s]: {
                            ...config.sentimentLabels[s],
                            color: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="admin-ts-section">
            <h3>Internal note</h3>
            <textarea
              className="admin-scex-note"
              rows={2}
              value={dataset.note || ''}
              onChange={(e) => {
                setDataset((prev) => ({ ...prev, note: e.target.value }))
                setDirty(true)
              }}
              placeholder="Ops notes for this partner dataset…"
            />
          </section>
        </details>
      )}

      {sub === 'actors' && (
        <div className="admin-edit-layout admin-ts-layout">
          <div className="admin-edit-side glass admin-ts-list-col">
            <div className="admin-side-list-head">
              <strong>Actors ({filteredActors.length})</strong>
            </div>
            <div className="admin-toolbar" style={{ margin: '0 10px 4px', gap: 6 }}>
              <button
                type="button"
                className="btn"
                onClick={() => addActor('kol')}
              >
                + KOL
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => addActor('user')}
              >
                + User
              </button>
            </div>
            <div className="admin-toolbar" style={{ margin: '0 10px 4px' }}>
              <input
                type="text"
                className="admin-search"
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
                placeholder="Search handle, name, tier…"
              />
            </div>
            <ul className="admin-side-list admin-ts-list">
              {filteredActors.map((acc) => {
                const active = selectedActorId === acc.id
                const pass = actorPassesThresholds(acc, config)
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      className={`admin-ts-list-item ${active ? 'is-active' : ''}`}
                      onClick={() => setSelectedActorId(acc.id)}
                    >
                      <XProfileAvatar
                        handle={acc.handle}
                        name={acc.displayName}
                        size={28}
                      />
                      <span className="admin-ts-row__meta">
                        <strong>
                          {acc.displayName}
                          {!pass ? ' · hidden' : ''}
                        </strong>
                        <small>
                          @{acc.handle} · {acc.kind} · V
                          {Math.round(actorVolumeMetric(acc, config))} · Q
                          {Math.round(acc.qualityScore)}
                          {acc.mapRank ? ` · map:${acc.mapRank}` : ''}
                          {acc.quadrant ? ` · ${acc.quadrant}` : ''}
                        </small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="admin-edit-main glass admin-ts-detail">
            {!selectedActor ? (
              <p className="muted">Chọn actor bên trái hoặc + KOL / + User.</p>
            ) : (
              <>
                <div className="admin-ts-detail__head">
                  <XProfileAvatar
                    handle={selectedActor.handle}
                    name={selectedActor.displayName}
                    size={48}
                    liveFallback
                  />
                  <div>
                    <h2>
                      {selectedActor.displayName}{' '}
                      <span className="muted">@{selectedActor.handle}</span>
                    </h2>
                    <p className="muted">
                      {selectedActor.kind} · quadrant{' '}
                      <strong>{selectedActor.quadrant || '—'}</strong>
                      {selectedActor.tier ? ` · tier ${selectedActor.tier}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => removeActor(selectedActor.id)}
                  >
                    Delete
                  </button>
                </div>
                <section className="admin-ts-section">
                  <h3>Identity & metrics</h3>
                  <div className="admin-ts-fields">
                    <label>
                      Display name
                      <input
                        value={selectedActor.displayName}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            displayName: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Handle
                      <input
                        value={selectedActor.handle}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            handle: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Kind
                      <select
                        value={selectedActor.kind}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            kind: e.target.value === 'user' ? 'user' : 'kol',
                          })
                        }
                      >
                        <option value="kol">KOL</option>
                        <option value="user">User</option>
                      </select>
                    </label>
                    <label>
                      Radar pipeline
                      <select
                        value={selectedActor.radarPipeline || 'none'}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            radarPipeline: e.target
                              .value as ScexRadarPipeline,
                          })
                        }
                      >
                        {RADAR_PIPELINES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-scex-span2">
                      Radar note (lý do promote / reject)
                      <input
                        value={selectedActor.radarNote || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            radarNote: e.target.value,
                          })
                        }
                        placeholder="VD: fit trading VN, eng tốt, đưa lên Gold…"
                      />
                    </label>
                    <label className="admin-scex-span2">
                      Avatar URL (R2)
                      <input
                        value={selectedActor.avatarUrl || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            avatarUrl: e.target.value || undefined,
                          })
                        }
                        placeholder={xAvatarUrl(selectedActor.handle)}
                      />
                    </label>
                    <label>
                      Avatar warmed
                      <input
                        value={selectedActor.avatarWarmedAt || '—'}
                        readOnly
                      />
                    </label>
                    <label>
                      Sourced at
                      <input
                        value={selectedActor.sourcedAt || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            sourcedAt: e.target.value || undefined,
                          })
                        }
                        placeholder="2026-08-03"
                      />
                    </label>
                    <label>
                      Tier (badge)
                      <input
                        value={selectedActor.tier || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            tier: e.target.value,
                          })
                        }
                        placeholder="Master / Diamond / …"
                      />
                    </label>
                    <label>
                      Followers
                      <input
                        type="number"
                        value={selectedActor.followers}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            followers: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label>
                      Reach 7d
                      <input
                        type="number"
                        value={selectedActor.reach7d ?? ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            reach7d: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label>
                      Raw activity (gốc+reply)
                      <input
                        type="number"
                        value={selectedActor.postsVolume}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            postsVolume: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label>
                      Volume score 0–100 (X)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={selectedActor.volumeScore ?? ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            volumeScore: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label>
                      Quality score 0–100 (Y)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={selectedActor.qualityScore}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            qualityScore: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label>
                      Gốc / Reply
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          min={0}
                          placeholder="gốc"
                          value={selectedActor.gocPosts ?? ''}
                          onChange={(e) =>
                            patchActor(selectedActor.id, {
                              gocPosts: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="reply"
                          value={selectedActor.replyPosts ?? ''}
                          onChange={(e) =>
                            patchActor(selectedActor.id, {
                              replyPosts: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </label>
                    <label>
                      Map rank
                      <input
                        value={selectedActor.mapRank || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            mapRank: e.target.value || undefined,
                          })
                        }
                        placeholder="challenger|master|…|none"
                      />
                    </label>
                    <label>
                      Sentiment
                      <select
                        value={selectedActor.sentiment}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            sentiment: e.target.value as ScexSentiment,
                          })
                        }
                      >
                        {SENTIMENTS.map((s) => (
                          <option key={s} value={s}>
                            {config.sentimentLabels[s]?.label || s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tracking code
                      <input
                        value={selectedActor.trackingCode || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            trackingCode: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Last post at (ISO)
                      <input
                        value={selectedActor.lastPostAt || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            lastPostAt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="admin-scex-check">
                      <input
                        type="checkbox"
                        checked={!!selectedActor.isWhitelisted}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            isWhitelisted: e.target.checked,
                          })
                        }
                      />
                      Whitelist (always show)
                    </label>
                    <label className="admin-scex-check">
                      <input
                        type="checkbox"
                        checked={!!selectedActor.isDenylisted}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            isDenylisted: e.target.checked,
                          })
                        }
                      />
                      Denylist (hide)
                    </label>
                    <label className="admin-scex-span2">
                      Notes
                      <textarea
                        rows={3}
                        value={selectedActor.notes || ''}
                        onChange={(e) =>
                          patchActor(selectedActor.id, {
                            notes: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {sub === 'pipeline' && (
        <div className="admin-scex-settings glass">
          <section className="admin-ts-section">
            <h3>Radar pipeline · SCEX → Map</h3>
            <p className="admin-ts-hint" style={{ opacity: 0.75, fontSize: 13 }}>
              Tài khoản harvest (list58 / blue mentions) được gắn{' '}
              <code>candidate</code> để admin review. Avatar warm lên R2{' '}
              <code>radar/avatars/&#123;handle&#125;.jpg</code>. Export JSON
              để import Radar khi phù hợp — không auto-publish map.
            </p>
            <div
              className="admin-toolbar"
              style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
            >
              {(
                [
                  ['candidate', 'Candidates'],
                  ['review', 'In review'],
                  ['promoted', 'Promoted'],
                  ['rejected', 'Rejected'],
                  ['none', 'None / map'],
                  ['needs_avatar', 'Needs avatar'],
                  ['all', 'All actors'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`btn ${pipelineFilter === k ? 'btn--primary' : ''}`}
                  onClick={() => setPipelineFilter(k)}
                >
                  {label} ({pipelineCounts[k] ?? 0})
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={exportRadarCandidates}
              >
                Export candidates JSON
              </button>
            </div>
            <div className="admin-scex-pipeline-table-wrap">
              <table className="admin-scex-pipeline-table">
                <thead>
                  <tr>
                    <th />
                    <th>Handle</th>
                    <th>Followers</th>
                    <th>V / Q</th>
                    <th>Quad</th>
                    <th>Avatar</th>
                    <th>Pipeline</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineActors.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <XProfileAvatar
                          handle={a.handle}
                          name={a.displayName}
                          size={32}
                          liveFallback
                        />
                      </td>
                      <td>
                        <strong>@{a.handle}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {a.displayName}
                          {a.mapRank ? ` · map:${a.mapRank}` : ''}
                        </div>
                      </td>
                      <td>{(a.followers || 0).toLocaleString()}</td>
                      <td>
                        {Math.round(a.volumeScore ?? a.postsVolume)} /{' '}
                        {Math.round(a.qualityScore)}
                      </td>
                      <td>
                        <code>{a.quadrant || '—'}</code>
                      </td>
                      <td>
                        {a.avatarWarmedAt || a.avatarUrl ? (
                          <span title={a.avatarUrl || xAvatarUrl(a.handle)}>
                            ✓
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <select
                          value={a.radarPipeline || 'none'}
                          onChange={(e) =>
                            patchActor(a.id, {
                              radarPipeline: e.target
                                .value as ScexRadarPipeline,
                            })
                          }
                        >
                          {RADAR_PIPELINES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          style={{ minWidth: 140 }}
                          value={a.radarNote || ''}
                          onChange={(e) =>
                            patchActor(a.id, { radarNote: e.target.value })
                          }
                          placeholder="ghi chú promote…"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pipelineActors.length === 0 && (
                <p className="muted">Không có actor trong filter này.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {sub === 'posts' && (
        <div className="admin-edit-layout admin-ts-layout">
          <div className="admin-edit-side glass admin-ts-list-col">
            <div className="admin-side-list-head">
              <strong>Posts ({dataset.posts.length})</strong>
            </div>
            <div className="admin-toolbar" style={{ margin: '0 10px 8px' }}>
              <button type="button" className="btn" onClick={addPost}>
                + Add post
              </button>
            </div>
            <ul className="admin-side-list admin-ts-list">
              {dataset.posts.map((p) => {
                const actor = actorsByHandle.get(scexHandleKey(p.handle))
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`admin-ts-list-item ${selectedPostId === p.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedPostId(p.id)}
                      title={`@${p.handle}`}
                    >
                      <XProfileAvatar
                        handle={p.handle}
                        name={actor?.displayName || p.handle}
                        size={28}
                      />
                      <span className="admin-ts-row__meta">
                        <strong>
                          @{p.handle}
                          {p.hidden ? ' · hidden' : ''}
                        </strong>
                        <small>
                          {p.sentiment} · {p.postedAt.slice(0, 16)} ·{' '}
                          {(p.text || '').slice(0, 48)}
                        </small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="admin-edit-main glass admin-ts-detail">
            {!selectedPost ? (
              <p className="muted">Chọn post hoặc + Add post.</p>
            ) : (
              <>
                <div className="admin-ts-detail__head">
                  <XProfileAvatar
                    handle={selectedPost.handle}
                    name={
                      actorsByHandle.get(scexHandleKey(selectedPost.handle))
                        ?.displayName || selectedPost.handle
                    }
                    size={36}
                  />
                  <h2>
                    Post
                    <span className="muted"> · @{selectedPost.handle}</span>
                  </h2>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => removePost(selectedPost.id)}
                  >
                    Delete
                  </button>
                </div>
                <div className="admin-ts-fields">
                  <label>
                    Handle
                    <input
                      value={selectedPost.handle}
                      onChange={(e) =>
                        patchPost(selectedPost.id, { handle: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Sentiment
                    <select
                      value={selectedPost.sentiment}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          sentiment: e.target.value as ScexSentiment,
                        })
                      }
                    >
                      {SENTIMENTS.map((s) => (
                        <option key={s} value={s}>
                          {config.sentimentLabels[s]?.label || s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-scex-span2">
                    X URL
                    <input
                      value={selectedPost.url}
                      onChange={(e) =>
                        patchPost(selectedPost.id, { url: e.target.value })
                      }
                      placeholder="https://x.com/…/status/…"
                    />
                  </label>
                  <label className="admin-scex-span2">
                    Text
                    <textarea
                      rows={4}
                      value={selectedPost.text}
                      onChange={(e) =>
                        patchPost(selectedPost.id, { text: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Posted at
                    <input
                      value={selectedPost.postedAt}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          postedAt: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Likes
                    <input
                      type="number"
                      value={selectedPost.likes ?? ''}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          likes: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    Replies
                    <input
                      type="number"
                      value={selectedPost.replies ?? ''}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          replies: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    Reposts
                    <input
                      type="number"
                      value={selectedPost.reposts ?? ''}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          reposts: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="admin-scex-check">
                    <input
                      type="checkbox"
                      checked={!!selectedPost.hidden}
                      onChange={(e) =>
                        patchPost(selectedPost.id, {
                          hidden: e.target.checked,
                        })
                      }
                    />
                    Hidden from public feed
                  </label>
                  <label className="admin-scex-span2">
                    Notes
                    <textarea
                      rows={2}
                      value={selectedPost.notes || ''}
                      onChange={(e) =>
                        patchPost(selectedPost.id, { notes: e.target.value })
                      }
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sub === 'preview' && (
        <ScexPreviewPanel dataset={dataset} visibleActors={visibleActors} />
      )}
    </div>
  )
}

function ScexPreviewPanel({
  dataset,
  visibleActors,
}: {
  dataset: ScexDataset
  visibleActors: ScexActor[]
}) {
  const { config } = dataset
  const sizes = visibleActors.map((a) => actorSizeValue(a, config))
  const maxSize = Math.max(...sizes, 1)
  const posts = dataset.posts.filter((p) => !p.hidden).slice(0, 40)

  return (
    <div className="admin-scex-preview">
      <div className="admin-scex-matrix glass">
        <header className="admin-scex-matrix__head">
          <h3>{config.matrixTitle}</h3>
          <p className="muted">
            X: {config.volumeAxis.label} · Y: {config.qualityAxis.label} · size:{' '}
            {config.sizeMetric} · {visibleActors.length} visible
          </p>
        </header>
        <div className="admin-scex-matrix__plot">
          <div className="admin-scex-matrix__quad admin-scex-matrix__quad--nurture">
            <span>{config.quadrantLabels.nurture?.title}</span>
            <small>{config.quadrantLabels.nurture?.subtitle}</small>
          </div>
          <div className="admin-scex-matrix__quad admin-scex-matrix__quad--stars">
            <span>{config.quadrantLabels.stars?.title}</span>
            <small>{config.quadrantLabels.stars?.subtitle}</small>
          </div>
          <div className="admin-scex-matrix__quad admin-scex-matrix__quad--ignore">
            <span>{config.quadrantLabels.ignore?.title}</span>
            <small>{config.quadrantLabels.ignore?.subtitle}</small>
          </div>
          <div className="admin-scex-matrix__quad admin-scex-matrix__quad--noise">
            <span>{config.quadrantLabels.noise?.title}</span>
            <small>{config.quadrantLabels.noise?.subtitle}</small>
          </div>
          <div className="admin-scex-matrix__cross-v" />
          <div className="admin-scex-matrix__cross-h" />
          {visibleActors.map((a) => {
            const { x, y } = actorMatrixPos(a, config)
            const sz = 18 + (actorSizeValue(a, config) / maxSize) * 36
            const ring =
              config.sentimentLabels[a.sentiment]?.color || '#94a3b8'
            return (
              <div
                key={a.id}
                className="admin-scex-bubble"
                style={{
                  left: `${x * 100}%`,
                  bottom: `${y * 100}%`,
                  width: sz,
                  height: sz,
                  borderColor: ring,
                }}
                title={`@${a.handle} V${Math.round(actorVolumeMetric(a, config))} Q${Math.round(a.qualityScore)} ${a.quadrant}${a.mapRank ? ` map:${a.mapRank}` : ''}${a.scoreLog ? `\n${a.scoreLog}` : ''}`}
              >
                <XProfileAvatar
                  handle={a.handle}
                  name={a.displayName}
                  size={Math.max(16, sz - 6)}
                />
              </div>
            )
          })}
        </div>
        <div className="admin-scex-matrix__axis-x">{config.volumeAxis.label} →</div>
        <div className="admin-scex-matrix__axis-y">
          ↑ {config.qualityAxis.label}
        </div>
      </div>

      <div className="admin-scex-feed glass">
        <header>
          <h3>{config.feedTitle}</h3>
          <p className="muted">{posts.length} recent posts (not hidden)</p>
        </header>
        <ul className="admin-scex-feed-list">
          {posts.map((p) => {
            const sent = config.sentimentLabels[p.sentiment]
            const actor = dataset.actors.find((a) => a.handle === p.handle)
            return (
              <li key={p.id} className="admin-scex-feed-item">
                <XProfileAvatar
                  handle={p.handle}
                  name={actor?.displayName || p.handle}
                  size={36}
                />
                <div className="admin-scex-feed-item__body">
                  <div className="admin-scex-feed-item__meta">
                    <strong>@{p.handle}</strong>
                    {actor?.tier && (
                      <span className="admin-scex-tier">{actor.tier}</span>
                    )}
                    <span
                      className="admin-scex-sent-badge"
                      style={{ background: sent?.color || '#64748b' }}
                    >
                      {sent?.label || p.sentiment}
                    </span>
                    <time>{p.postedAt.slice(0, 16)}</time>
                  </div>
                  <p>{p.text || '—'}</p>
                  {safeHref(p.url) && (
                    <a href={safeHref(p.url)} target="_blank" rel="noreferrer">
                      Open on X ↗
                    </a>
                  )}
                </div>
              </li>
            )
          })}
          {!posts.length && (
            <li className="muted">No posts yet — add in Livefeed posts tab.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
