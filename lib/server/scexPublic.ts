/** Public GET view: drop hidden posts and admin-only actor/post fields. */

export function publicScexDataset<T extends {
  actors?: unknown[]
  posts?: unknown[]
}>(data: T): T {
  const posts = Array.isArray(data.posts) ? data.posts : []
  const actors = Array.isArray(data.actors) ? data.actors : []
  return {
    ...data,
    posts: posts
      .filter((p) => {
        if (!p || typeof p !== 'object') return false
        return (p as { hidden?: unknown }).hidden !== true
      })
      .map((p) => {
        const row = { ...(p as Record<string, unknown>) }
        delete row.notes
        delete row.hidden
        return row
      }),
    actors: actors.map((a) => {
      if (!a || typeof a !== 'object') return a
      const row = { ...(a as Record<string, unknown>) }
      delete row.scoreLog
      delete row.radarNote
      delete row.trackingCode
      return row
    }),
  }
}
