import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminDashboard } from './pages/AdminDashboard.tsx'

function getRoute(): 'map' | 'admin' {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  // #/admin, #/admin/feed, #/admin/legend …
  return h === 'admin' || h.startsWith('admin/') || h.startsWith('admin?')
    ? 'admin'
    : 'map'
}

function Root() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return route === 'admin' ? <AdminDashboard /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
