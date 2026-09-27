import { request } from 'node:https'
// Node fetch has a separate headers timeout; use a bounded HTTPS request for long research responses.
export const longResearchFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  if (url.protocol !== 'https:') throw new Error('Research endpoint must use HTTPS')
  return new Promise<Response>((resolve, reject) => {
    const req = request(url, { method: init?.method || 'GET', headers: Object.fromEntries(new Headers(init?.headers).entries()), signal: init?.signal || undefined }, res => {
      let bytes = 0, closed = false
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          res.on('data', (chunk: Buffer) => { if (closed) return; bytes += chunk.length; if (bytes > 8_000_000) { closed = true; controller.error(new Error('Research response too large')); req.destroy(); return } controller.enqueue(chunk) })
          res.on('end', () => { if (!closed) { closed = true; controller.close() } })
          res.on('error', error => { if (!closed) { closed = true; controller.error(error) } })
          res.on('aborted', () => { if (!closed) { closed = true; controller.error(new Error('Research response interrupted')) } })
        },
        cancel() { closed = true; res.destroy?.() },
      })
      const headers = new Headers()
      for (const [name, value] of Object.entries(res.headers || {})) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      resolve(new Response(body, { status: res.statusCode || 502, headers }))
    })
    req.setTimeout(1_800_000, () => req.destroy(new Error('Research response timeout')))
    req.on('error', reject)
    req.end(typeof init?.body === 'string' ? init.body : undefined)
  })
}
