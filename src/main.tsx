import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminDashboard } from './pages/AdminDashboard.tsx'
import { ScexTrackingPage } from './pages/ScexTrackingPage.tsx'

function getRoute(): 'map' | 'admin' | 'scex' {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  // #/admin, #/admin/feed, #/admin/legend …
  if (h === 'admin' || h.startsWith('admin/') || h.startsWith('admin?'))
    return 'admin'
  // Public partner preview (not under admin)
  if (h === 'scex' || h.startsWith('scex/') || h.startsWith('scex?'))
    return 'scex'
  return 'map'
}

function Root() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'admin') return <AdminDashboard />
  if (route === 'scex') return <ScexTrackingPage />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
