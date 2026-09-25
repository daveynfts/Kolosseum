import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { SiteChrome } from './components/SiteChrome'
import { getAdminToken, setAdminToken } from './lib/feedStore'
import './components/SiteChrome.css'
import './styles/kolosseum.css'

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
const ReportPage = lazy(() =>
  import('./research/ReportPage.tsx').then((m) => ({ default: m.ReportPage })),
)
const BuyerPage = lazy(() =>
  import('./research/BuyerPage.tsx').then((m) => ({ default: m.BuyerPage })),
)
const RecordedDemoPage = lazy(() =>
  import('./research/RecordedDemoPage.tsx').then((m) => ({ default: m.RecordedDemoPage })),
)

function RouteFallback() {
  return (
    <div className="boot-splash" aria-busy="true">
      <img
        className="boot-splash__mark"
        src="/kolosseum-mark.svg"
        alt=""
        width={64}
        height={64}
        decoding="async"
      />
      <p className="boot-splash__title">Kolosseum</p>
      <small>The Vietnamese crypto KOL arena</small>
    </div>
  )
}

function normalizePathname(): string {
  const p = window.location.pathname.toLowerCase()
  // strip trailing slash except root
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1)
  return p || '/'
}

function getRoute(): 'admin' | 'scex' | 'report' | 'me' | 'replay' {
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
  if (__DEEP_RESEARCH_ENABLED__ && path === '/demo/replay') return 'replay'
  if (__DEEP_RESEARCH_ENABLED__ && path === '/me') return 'me'
  if (__DEEP_RESEARCH_ENABLED__ && path.startsWith('/reports/')) return 'report'
  return 'scex'
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

/** Keep old entry URLs pointed at the Kolosseum arena. */
function migrateLegacyArenaPaths() {
  const path = normalizePathname()
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (hash === 'admin' || hash.startsWith('admin/') || hash.startsWith('admin?')) return
  if (path === '/' || /^\/events?(?:\/|$)/.test(path)) {
    window.history.replaceState(null, '', '/scex' + window.location.search)
  }
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
        Enter <code>FEED_ADMIN_TOKEN</code> to open the editor. The token is kept in this tab session.
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
        <a href="/scex">← Back to Kolosseum</a>
      </p>
    </div>
  )
}

function Root() {
  const [route, setRoute] = useState(() => {
    migrateLegacyScexHash()
    migrateLegacyArenaPaths()
    return getRoute()
  })

  useEffect(() => {
    migrateLegacyScexHash()
    migrateLegacyArenaPaths()
    setRoute(getRoute())
    const onHash = () => {
      migrateLegacyScexHash()
      migrateLegacyArenaPaths()
      setRoute(getRoute())
    }
    const onPop = () => { migrateLegacyArenaPaths(); setRoute(getRoute()) }
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

  if (route === 'replay') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="Recorded demo failed to render">
          <div className="app-shell app-shell--arena">
            <SiteChrome active="scex" />
            <RecordedDemoPage />
          </div>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  if (route === 'me') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="Buyer page failed to render">
          <div className="app-shell app-shell--arena">
            <SiteChrome active="scex" />
            <BuyerPage />
          </div>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  if (route === 'report') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SceneErrorBoundary title="Report page failed to render">
          <div className="app-shell app-shell--arena">
            <SiteChrome active="scex" />
            <ReportPage />
          </div>
        </SceneErrorBoundary>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <SceneErrorBoundary title="Kolosseum failed to render">
        <div className="app-shell app-shell--arena">
          <SiteChrome active="scex" />
          <ScexTrackingPage />
        </div>
      </SceneErrorBoundary>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
