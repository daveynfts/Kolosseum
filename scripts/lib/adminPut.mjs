/**
 * Shared admin PUT: GET live object first, then PUT with baseUpdatedAt.
 * New publish scripts should use this so they cannot silently overwrite R2.
 *
 *   import { adminPutJson } from './lib/adminPut.mjs'
 *   const res = await adminPutJson(`${apiBase}/api/feed`, token, payload)
 */

function updatedAtOf(obj) {
  if (!obj || typeof obj !== 'object') return undefined
  const v = obj.updatedAt || obj.generatedAt
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/**
 * @param {string} url
 * @param {string} token
 * @param {Record<string, unknown>} body
 * @param {{ getUrl?: string }} [opts]
 */
export async function adminPutJson(url, token, body, opts = {}) {
  const path = String(url).split('?')[0]
  // Events public GET strips hidden rows — always read the admin slice first.
  const defaultGet = path.includes('/api/event-side-events')
    ? `${path}?all=1&t=${Date.now()}`
    : `${path}?t=${Date.now()}`
  const getUrl = opts.getUrl || defaultGet
  const getRes = await fetch(getUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  let baseUpdatedAt
  if (getRes.ok) {
    const cur = await getRes.json().catch(() => null)
    baseUpdatedAt = updatedAtOf(cur)
  } else if (getRes.status !== 404 && getRes.status !== 503) {
    throw new Error(
      `GET ${getRes.status} before PUT ${url} — aborting to avoid overwrite`,
    )
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...body, baseUpdatedAt }),
  })
  return putRes
}
