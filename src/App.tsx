import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { Hud, MapNavControls } from './components/Hud'
import { FeedPanel } from './components/FeedPanel'
import { ComparePanel } from './components/ComparePanel'
import { SiteChrome } from './components/SiteChrome'
import {
  KOLS_EVENT,
  loadKols,
  loadKolsWithSource,
  visibleKols as onlyVisible,
} from './lib/kolStore'
import type { Kol, KolRank, Niche, StatusLabel } from './types'
import { formatRank, getKolNiches, getKolRank, kolMatchesNiche } from './types'
import './App.css'
import './components/SiteChrome.css'

const Scene = lazy(() =>
  import('./components/Scene.tsx').then((m) => ({ default: m.Scene })),
)

function SceneLoading() {
  return <div className="canvas-loading" aria-busy="true" />
}

const SHORTLIST_MAX = 5

function kolMatchesQuery(k: Kol, q: string): boolean {
  if (!q) return true
  return (
    k.displayName.toLowerCase().includes(q) ||
    k.handle.toLowerCase().includes(q) ||
    getKolNiches(k).some((n) => n.toLowerCase().includes(q)) ||
    formatRank(k).toLowerCase().includes(q)
  )
}

function sortByScore(list: Kol[]): Kol[] {
  return [...list].sort(
    (a, b) =>
      b.score - a.score ||
      b.followers - a.followers ||
      a.handle.localeCompare(b.handle),
  )
}

function App() {
  const [kols, setKols] = useState<Kol[]>(() => loadKols())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterNiche, setFilterNiche] = useState<Niche | 'All'>('All')
  const [filterRank, setFilterRank] = useState<KolRank | 'All'>('All')
  const [filterStatus, setFilterStatus] = useState<StatusLabel | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRotate, setAutoRotate] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [shortlistIds, setShortlistIds] = useState<string[]>([])

  useEffect(() => {
    document.title = "Davey's Radar — VN KOL Map"
  }, [])

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

  useEffect(() => {
    let seq = 0
    const reloadLocal = () => setKols(loadKols())
    const reloadServer = () => {
      const n = ++seq
      void loadKolsWithSource().then(({ kols: list }) => {
        if (n !== seq) return
        setKols(list)
      })
    }
    const reloadAfterAdmin = () => {
      reloadLocal()
      reloadServer()
    }
    window.addEventListener('focus', reloadServer)
    window.addEventListener('hashchange', reloadServer)
    window.addEventListener('storage', reloadAfterAdmin)
    window.addEventListener(KOLS_EVENT, reloadAfterAdmin)
    return () => {
      window.removeEventListener('focus', reloadServer)
      window.removeEventListener('hashchange', reloadServer)
      window.removeEventListener('storage', reloadAfterAdmin)
      window.removeEventListener(KOLS_EVENT, reloadAfterAdmin)
    }
  }, [])

  const publicKols = useMemo(() => onlyVisible(kols), [kols])

  const visibleKols = useMemo(() => {
    return publicKols.filter((k) => {
      if (filterRank !== 'All' && getKolRank(k) !== filterRank) return false
      if (!kolMatchesNiche(k, filterNiche)) return false
      if (filterStatus !== 'All' && k.statusLabel !== filterStatus) return false
      return true
    })
  }, [publicKols, filterRank, filterNiche, filterStatus])

  const q = searchQuery.trim().toLowerCase()
  const searchHits = useMemo(() => {
    const list = q
      ? visibleKols.filter((k) => kolMatchesQuery(k, q))
      : visibleKols
    return sortByScore(list)
  }, [visibleKols, q])
  const sceneKols = q ? searchHits : visibleKols

  useEffect(() => {
    if (!selectedId) return
    if (!sceneKols.some((k) => k.id === selectedId)) {
      setSelectedId(null)
    }
  }, [sceneKols, selectedId])

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

  const commitSearch = useCallback(() => {
    const hit = searchHits[0]
    if (hit) setSelectedId(hit.id)
  }, [searchHits])

  return (
    <div className="app-shell app-shell--map">
      <div className="app app--2d">
        <div className="canvas-wrap">
          <SceneErrorBoundary>
            <Suspense fallback={<SceneLoading />}>
              <Scene
                kols={sceneKols}
                selectedId={selectedId}
                filterNiche={filterNiche}
                onSelect={onSelect}
                autoRotate={autoRotate}
              />
            </Suspense>
          </SceneErrorBoundary>
        </div>
        <div className="map-html-layer" id="map-html-layer" />
        <SiteChrome
          overlay
          active="map"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            onSubmit: commitSearch,
            placeholder: 'Tìm KOL, @handle, niche…',
          }}
          trailing={
            <MapNavControls
              filterNiche={filterNiche}
              filterRank={filterRank}
              filterStatus={filterStatus}
              feedOpen={feedOpen}
              onFilter={(n) =>
                setFilterNiche((prev) => (n !== 'All' && prev === n ? 'All' : n))
              }
              onFilterRank={(r) =>
                setFilterRank((prev) => (r !== 'All' && prev === r ? 'All' : r))
              }
              onFilterStatus={(s) =>
                setFilterStatus((prev) =>
                  s !== 'All' && prev === s ? 'All' : s,
                )
              }
              onToggleFeed={() => setFeedOpen((v) => !v)}
            />
          }
        />
        <Hud
          kols={q ? searchHits : visibleKols}
          allKols={publicKols}
          selected={selected}
          searchQuery={searchQuery}
          shortlistIds={shortlistIds}
          autoRotate={autoRotate}
          compareOpen={compareOpen}
          onSelect={(k) => setSelectedId(k?.id ?? null)}
          onToggleRotate={() => setAutoRotate((v) => !v)}
          onToggleCompare={() => setCompareOpen((v) => !v)}
          onToggleShortlist={onToggleShortlist}
        />
        <FeedPanel
          open={feedOpen}
          onClose={() => setFeedOpen(false)}
          kols={publicKols}
          onSelectKol={(k) => {
            if (!k) return
            setFilterNiche('All')
            setFilterRank('All')
            setFilterStatus('All')
            setSearchQuery('')
            setSelectedId(k.id)
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
    </div>
  )
}

export default App
