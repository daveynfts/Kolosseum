import { describe, expect, it } from 'vitest'
import { readSurfStream } from './surfStream'
function stream(text: string) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3)); c.close() } }), { headers: { 'content-type': 'text/event-stream' } })
}
describe('Surf Responses streaming', () => {
  it('handles split UTF-8, CRLF and heartbeat frames and preserves completed usage', async () => {
    const events: unknown[] = []
    const result = await readSurfStream(stream(': ping\r\n\r\ndata: {"type":"response.output_text.delta","delta":"Tiếng Việt"}\r\n\r\ndata: {"type":"response.completed","response":{"status":"completed","output_text":"Tiếng Việt","meta":{"credits_used":200}}}\r\n\r\n'), async e => { events.push(e) })
    expect(events).toHaveLength(2)
    expect(await result.json()).toMatchObject({ output_text: 'Tiếng Việt', meta: { credits_used: 200 } })
  })
  it('never publishes partial output without a completion event', async () => {
    const events: unknown[] = []
    await expect(readSurfStream(stream('data: {"type":"response.output_text.delta","delta":"partial"}\n\ndata: [DONE]\n\n'), async e => { events.push(e) })).rejects.toThrow('without a completed')
    expect(events).toHaveLength(1)
  })
  it('preserves failure events before rejecting', async () => {
    const events: unknown[] = []
    await expect(readSurfStream(stream('data: {"type":"response.failed"}\n\n'), async e => { events.push(e) })).rejects.toThrow('did not complete')
    expect(events).toHaveLength(1)
  })
  it('passes through HTTP errors and nonstreaming JSON', async () => {
    const response = new Response('gateway timeout', { status: 504 })
    expect(await readSurfStream(response, async () => {})).toBe(response)
  })
})
