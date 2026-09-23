const configured = import.meta.env.VITE_RESEARCH_API_URL?.trim()
const base = configured ? configured.replace(/\/$/, '') : '/dr-api'

export function researchApi(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export const ADMIN_TOKEN_SESSION_KEY = 'kolosseum-m1-admin-token'
