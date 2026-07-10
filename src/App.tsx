import { useCallback, useEffect, useMemo, useState } from 'react'
import { Scene } from './components/Scene'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { Hud } from './components/Hud'
import { FeedPanel } from './components/FeedPanel'
import { ComparePanel } from './components/ComparePanel'
import { loadKols, visibleKols as onlyVisible } from './lib/kolStore'
import type { ViewMode } from './lib/layout'
import type { Kol, Niche, StatusLabel } from './types'
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
  return '3d'
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

  // Reload when returning from admin (hashchange / focus)
  useEffect(() => {
    const reload = () => setKols(loadKols())
    window.addEventListener('focus', reload)
    window.addEventListener('hashchange', reload)
    window.addEventListener('storage', reload)
    return () => {
      window.removeEventListener('focus', reload)
      window.removeEventListener('hashchange', reload)
      window.removeEventListener('storage', reload)
    }
  }, [])

  const publicKols = useMemo(() => onlyVisible(kols), [kols])

  const visibleKols = useMemo(() => {
    return publicKols.filter((k) => {
      if (filterTier !== 'All' && k.tier !== filterTier) return false
      if (filterNiche !== 'All' && k.niche !== filterNiche) return false
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
        onFilter={setFilterNiche}
        onFilterTier={setFilterTier}
        onFilterStatus={setFilterStatus}
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
