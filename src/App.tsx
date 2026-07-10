import { useCallback, useEffect, useMemo, useState } from 'react'
import { Scene } from './components/Scene'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { Hud } from './components/Hud'
import { FeedPanel } from './components/FeedPanel'
import { ComparePanel } from './components/ComparePanel'
import {
  KOLS_EVENT,
  loadKols,
  loadKolsWithSource,
  visibleKols as onlyVisible,
} from './lib/kolStore'
import type { ViewMode } from './lib/layout'
import type { Kol, Niche, StatusLabel } from './types'
import { kolMatchesNiche } from './types'
import './App.css'

const SHORTLIST_MAX = 5
const VIEW_KEY = 'vn-kol-map-view-mode'

function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === '2d' || v === '3d') return v
  } catch {
    /* ignore */
  }
  return '2d' // default 2.5D (lite cloud)
}

function App() {
  const [kols, setKols] = useState<Kol[]>(() => loadKols())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterNiche, setFilterNiche] = useState<Niche | 'All'>('All')
  const [filterTier, setFilterTier] = useState<1 | 2 | 3 | 'All'>('All')
  const [filterStatus, setFilterStatus] = useState<StatusLabel | 'All'>('All')
  const [autoRotate, setAutoRotate] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode())
  const [feedOpen, setFeedOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [shortlistIds, setShortlistIds] = useState<string[]>([])

  const onViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [])

  // Shared KOL list: server R2 first, then local/seed
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { kols: list } = await loadKolsWithSource()
      if (!cancelled) setKols(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Reload when returning from admin / multi-tab / after admin save
  useEffect(() => {
    const reloadLocal = () => setKols(loadKols())
    const reloadServer = () => {
      void loadKolsWithSource().then(({ kols: list }) => setKols(list))
    }
    window.addEventListener('focus', reloadServer)
    window.addEventListener('hashchange', reloadServer)
    window.addEventListener('storage', reloadLocal)
    window.addEventListener(KOLS_EVENT, reloadLocal)
    return () => {
      window.removeEventListener('focus', reloadServer)
      window.removeEventListener('hashchange', reloadServer)
      window.removeEventListener('storage', reloadLocal)
      window.removeEventListener(KOLS_EVENT, reloadLocal)
    }
  }, [])

  const publicKols = useMemo(() => onlyVisible(kols), [kols])

  const visibleKols = useMemo(() => {
    return publicKols.filter((k) => {
      if (filterTier !== 'All' && k.tier !== filterTier) return false
      if (!kolMatchesNiche(k, filterNiche)) return false
      if (filterStatus !== 'All' && k.statusLabel !== filterStatus) return false
      return true
    })
  }, [publicKols, filterTier, filterNiche, filterStatus])

  const selected = useMemo(
    () => publicKols.find((k) => k.id === selectedId) ?? null,
    [publicKols, selectedId],
  )

  const shortlist = useMemo(
    () =>
      shortlistIds
        .map((id) => publicKols.find((k) => k.id === id))
        .filter((k): k is Kol => !!k),
    [shortlistIds, publicKols],
  )

  const onSelect = useCallback((kol: Kol | null) => {
    if (!kol || !kol.id) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => (prev === kol.id ? null : kol.id))
  }, [])

  const onToggleShortlist = useCallback((kol: Kol) => {
    setShortlistIds((prev) => {
      if (prev.includes(kol.id)) return prev.filter((id) => id !== kol.id)
      if (prev.length >= SHORTLIST_MAX) return prev
      setCompareOpen(true)
      return [...prev, kol.id]
    })
  }, [])

  return (
    <div className={`app app--${viewMode}`}>
      <div className="canvas-wrap">
        <SceneErrorBoundary>
          <Scene
            kols={visibleKols}
            selectedId={selectedId}
            filterNiche={filterNiche}
            onSelect={onSelect}
            autoRotate={autoRotate}
            viewMode={viewMode}
          />
        </SceneErrorBoundary>
      </div>
      <Hud
        kols={visibleKols}
        allKols={publicKols}
        selected={selected}
        filterNiche={filterNiche}
        filterTier={filterTier}
        filterStatus={filterStatus}
        shortlistIds={shortlistIds}
        autoRotate={autoRotate}
        viewMode={viewMode}
        feedOpen={feedOpen}
        compareOpen={compareOpen}
        onFilter={(n) =>
          setFilterNiche((prev) => (n !== 'All' && prev === n ? 'All' : n))
        }
        onFilterTier={(t) =>
          setFilterTier((prev) => (t !== 'All' && prev === t ? 'All' : t))
        }
        onFilterStatus={(s) =>
          setFilterStatus((prev) => (s !== 'All' && prev === s ? 'All' : s))
        }
        onSelect={(k) => setSelectedId(k?.id ?? null)}
        onToggleRotate={() => setAutoRotate((v) => !v)}
        onViewMode={onViewMode}
        onToggleFeed={() => setFeedOpen((v) => !v)}
        onToggleCompare={() => setCompareOpen((v) => !v)}
        onToggleShortlist={onToggleShortlist}
      />
      <FeedPanel
        open={feedOpen}
        onClose={() => setFeedOpen(false)}
        kols={publicKols}
        onSelectKol={(k) => {
          if (k) {
            setFilterTier(1)
            setSelectedId(k.id)
          }
        }}
      />
      <ComparePanel
        open={compareOpen}
        shortlist={shortlist}
        onClose={() => setCompareOpen(false)}
        onRemove={(id) =>
          setShortlistIds((prev) => prev.filter((x) => x !== id))
        }
        onClear={() => setShortlistIds([])}
        onSelect={(k) => setSelectedId(k.id)}
      />
      <div className="vignette" />
    </div>
  )
}

export default App
