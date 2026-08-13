import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { SiteChrome } from './components/SiteChrome'
import { getAdminToken, setAdminToken } from './lib/feedStore'
import './components/SiteChrome.css'

const App = lazy(() => import('./App.tsx'))
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard.tsx').then((m) => ({
    default: m.AdminDashboard,
  })),
)
const ScexTrackingPage = lazy(() =>
  import('./pages/ScexTrackingPage.tsx').then((m) => ({
    default: m.ScexTrackingPage,
  })),
)
const EventMapPage = lazy(() =>
  import('./pages/EventMapPage.tsx').then((m) => ({
    default: m.EventMapPage,
  })),
)
const ScexEventBanner = lazy(() =>
  import('./components/ScexEventBanner.tsx').then((m) => ({
    default: m.ScexEventBanner,
  })),
)

function RouteFallback() {
  return (
    <div className="boot-splash" aria-busy="true">
      <img
        className="boot-splash__mark"
        src="/logo.jpg"
        alt=""
        width={64}
        height={64}
        decoding="async"
      />
      <p className="boot-splash__title">Davey's Radar</p>
      <small>Bấm avatar · Lọc rank · Mở Feed</small>
    </div>
  )
}

function normalizePathname(): string {
  const p = window.location.pathname.toLowerCase()
  // strip trailing slash except root
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1)
  return p || '/'
}

function getRoute(): 'map' | 'admin' | 'scex' | 'event' {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  const path = normalizePathname()
  // Admin hash/path always wins so /scex#/admin and /admin work.
  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    h === 'admin' ||
    h.startsWith('admin/') ||
    h.startsWith('admin?')
  ) {
    return 'admin'
  }
  if (path.startsWith('/event')) return 'event'
  if (path === '/scex' || path.startsWith('/scex/')) return 'scex'
  if (h === 'scex' || h.startsWith('scex/') || h.startsWith('scex?'))
    return 'scex'
  if (h === 'event' || h.startsWith('event/') || h.startsWith('event?'))
    return 'event'
  return 'map'
}

/** Redirect legacy #/scex → /scex (keeps bookmarks working). */
function migrateLegacyScexHash() {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (!(h === 'scex' || h.startsWith('scex/') || h.startsWith('scex?'))) return
  const path = normalizePathname()
  if (path === '/scex' || path.startsWith('/scex/')) {
    // already on path route — just clear hash
    window.history.replaceState(
      null,
      '',
      `/scex${window.location.search}`,
    )
    return
  }
  window.history.replaceState(null, '', `/scex${window.location.search}`)
}

function AdminGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getAdminToken())
  const [input, setInput] = useState('')

  if (token.trim()) {
    return <>{children}</>
  }

  return (
    <div className="admin-gate glass">
      <h1>Admin</h1>
      <p>
        Dán <code>FEED_ADMIN_TOKEN</code> để mở editor. Token lưu trong phiên
        tab (sessionStorage).
      </p>
      <label className="admin-gate__row">
        Token
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="FEED_ADMIN_TOKEN"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          const t = input.trim().replace(/^["']|["']$/g, '')
          if (!t) return
          setAdminToken(t)
          setToken(t)
        }}
      >
        Continue
      </button>
      <p className="admin-gate__hint">
        <a href="/">← Back to map</a>
      </p>
    </div>
  )
}

function Root() {
  const [route, setRoute] = useState(() => {
    migrateLegacyScexHash()
    return getRoute()
  })

  useEffect(() => {
    migrateLegacyScexHash()
    setRoute(getRoute())
    const onHash = () => {
      migrateLegacyScexHash()
      setRoute(getRoute())
    }
    const onPop = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  if (route === 'admin') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="Admin failed to render">
          <AdminGate>
            <AdminDashboard />
          </AdminGate>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  if (route === 'event') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="Event map failed to render">
          <div className="app-shell app-shell--map">
            <SiteChrome active="event" overlay />
            <EventMapPage />
          </div>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  if (route === 'scex') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="SCEX page failed to render">
          <div className="app-shell">
            <SiteChrome active="scex" />
            <ScexEventBanner />
            <ScexTrackingPage />
          </div>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <App />
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
