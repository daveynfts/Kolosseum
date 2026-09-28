/** Consume Responses SSE; partial text is evidence, never a completed report. */
export async function readSurfStream(response: Response, onEvent: (event: Record<string, unknown>) => Promise<void>): Promise<Response> {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) return response
  if (!response.body) throw new Error('Surf stream has no body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', bytes = 0
  let completed: Record<string, unknown> | undefined
  async function frame(raw: string) {
    const data = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') return
    const event = JSON.parse(data) as Record<string, unknown>
    await onEvent(event)
    if (['error', 'response.failed', 'response.incomplete'].includes(String(event.type))) throw new Error('Surf stream did not complete successfully; captured events preserved')
    if (event.type === 'response.completed') {
      const result = event.response as Record<string, unknown> | undefined
      if (!result || result.status !== 'completed') throw new Error('Invalid Surf completion event')
      completed = result
    }
  }
  try {
    while (!completed) {
      const { value, done } = await reader.read()
      if (value) { bytes += value.byteLength; if (bytes > 8_000_000) throw new Error('Surf stream too large') }
      buffer += decoder.decode(value, { stream: !done })
      buffer = buffer.replaceAll('\r\n', '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
        await frame(raw)
      }
      if (done) { if (buffer.trim()) await frame(buffer); break }
    }
    if (!completed) throw new Error('Surf stream ended without a completed response; partial events preserved')
    return new Response(JSON.stringify(completed), { headers: { 'Content-Type': 'application/json' } })
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
