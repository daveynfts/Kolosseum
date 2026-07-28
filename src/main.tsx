import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { getAdminToken, setAdminToken } from './lib/feedStore'

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
const ScexEventBanner = lazy(() =>
  import('./components/ScexEventBanner.tsx').then((m) => ({
    default: m.ScexEventBanner,
  })),
)

function RouteFallback() {
  return (
    <div className="route-fallback" aria-busy="true">
      Loading…
    </div>
  )
}

function getRoute(): 'map' | 'admin' | 'scex' {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (h === 'admin' || h.startsWith('admin/') || h.startsWith('admin?'))
    return 'admin'
  if (h === 'scex' || h.startsWith('scex/') || h.startsWith('scex?'))
    return 'scex'
  return 'map'
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
          const t = input.trim()
          if (!t) return
          setAdminToken(t)
          setToken(t)
        }}
      >
        Continue
      </button>
      <p className="admin-gate__hint">
        <a href="#/">← Back to map</a>
      </p>
    </div>
  )
}

function Root() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'admin') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AdminGate>
          <AdminDashboard />
        </AdminGate>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <div className="app-shell">
        <ScexEventBanner />
        {route === 'scex' ? <ScexTrackingPage /> : <App />}
      </div>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
