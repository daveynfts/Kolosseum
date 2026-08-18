// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, mockReq, mockRes } from './httpHarness.js'

const r2 = vi.hoisted(() => ({
  getJson: vi.fn(),
  getJsonMeta: vi.fn(),
  putJson: vi.fn(),
  del: vi.fn(),
}))

vi.mock('./r2.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./r2.js')>()
  return {
    ...actual,
    r2Client: () => ({}),
    r2Configured: () => true,
    r2GetJson: r2.getJson,
    r2GetJsonMeta: r2.getJsonMeta,
    r2PutJson: r2.putJson,
    r2Delete: r2.del,
  }
})

import feedHandler from './handlers/feed.js'
import kolsHandler from './handlers/kols.js'
import reportsHandler from './handlers/kol-reports.js'
import scexHandler from './handlers/scex-tracking.js'
import followersHandler from './handlers/recent-followers.js'
import jsonHandler from '../../api/json.js'

const STAMP = '2026-08-17T00:00:00.000Z'

function auth() {
  return { authorization: `Bearer ${ADMIN}` }
}

describe('JSON write handlers', () => {
  const prevToken = process.env.FEED_ADMIN_TOKEN

  beforeEach(() => {
    process.env.FEED_ADMIN_TOKEN = ADMIN
    r2.getJson.mockReset()
    r2.getJsonMeta.mockReset()
    r2.putJson.mockReset()
    r2.del.mockReset()
    r2.putJson.mockResolvedValue(undefined)
    r2.del.mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (prevToken === undefined) delete process.env.FEED_ADMIN_TOKEN
    else process.env.FEED_ADMIN_TOKEN = prevToken
  })

  it('PUT /api/kols without token → 401', async () => {
    const res = mockRes()
    await kolsHandler(
      mockReq({ method: 'PUT', body: { kols: [{ id: 'a' }] } }),
      res,
    )
    expect(res.statusCode).toBe(401)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('PUT /api/kols empty list → 400 (would wipe R2)', async () => {
    const res = mockRes()
    await kolsHandler(
      mockReq({ method: 'PUT', headers: auth(), body: { kols: [] } }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('PUT /api/kols stale baseUpdatedAt → 409', async () => {
    r2.getJsonMeta.mockResolvedValue({
      data: { updatedAt: '2026-08-18T00:00:00.000Z', kols: [{ id: 'x' }] },
      etag: '"1"',
    })
    const res = mockRes()
    await kolsHandler(
      mockReq({
        method: 'PUT',
        headers: auth(),
        body: {
          kols: [{ id: 'a', handle: 'a' }],
          baseUpdatedAt: STAMP,
        },
      }),
      res,
    )
    expect(res.statusCode).toBe(409)
    expect((res.body as { error?: string }).error).toBe('conflict')
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('PUT /api/kols matching baseUpdatedAt → 200', async () => {
    r2.getJsonMeta.mockResolvedValue({
      data: { updatedAt: STAMP, kols: [{ id: 'x' }] },
      etag: '"1"',
    })
    const res = mockRes()
    await kolsHandler(
      mockReq({
        method: 'PUT',
        headers: auth(),
        body: {
          kols: [{ id: 'a', handle: 'a' }, { id: 'b', hidden: true }],
          baseUpdatedAt: STAMP,
        },
      }),
      res,
    )
    expect(res.statusCode).toBe(200)
    expect(r2.putJson).toHaveBeenCalledTimes(1)
    const payload = r2.putJson.mock.calls[0][2] as { kols: unknown[] }
    expect(payload.kols).toHaveLength(2)
  })

  it('GET /api/kols public strips hidden', async () => {
    r2.getJson.mockResolvedValue({
      updatedAt: STAMP,
      kols: [
        { id: 'a', handle: 'vis' },
        { id: 'b', handle: 'hid', hidden: true },
      ],
    })
    const res = mockRes()
    await kolsHandler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(200)
    const body = res.body as { kols: { handle: string }[]; count: number }
    expect(body.kols.map((k) => k.handle)).toEqual(['vis'])
    expect(body.count).toBe(1)
  })

  it('GET /api/kols?all=1 without token → 401', async () => {
    const res = mockRes()
    await kolsHandler(mockReq({ method: 'GET', query: { all: '1' } }), res)
    expect(res.statusCode).toBe(401)
    expect(r2.getJson).not.toHaveBeenCalled()
  })

  it('PUT /api/feed empty posts → 400', async () => {
    const res = mockRes()
    await feedHandler(
      mockReq({ method: 'PUT', headers: auth(), body: { posts: [] } }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('PUT /api/feed stale generatedAt → 409', async () => {
    r2.getJsonMeta.mockResolvedValue({
      data: { generatedAt: '2026-08-18T00:00:00.000Z', posts: [{ id: '1' }] },
      etag: '"f"',
    })
    const res = mockRes()
    await feedHandler(
      mockReq({
        method: 'PUT',
        headers: auth(),
        body: { posts: [{ id: '2' }], baseUpdatedAt: STAMP },
      }),
      res,
    )
    expect(res.statusCode).toBe(409)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('DELETE /api/feed without token → 401', async () => {
    const res = mockRes()
    await feedHandler(mockReq({ method: 'DELETE' }), res)
    expect(res.statusCode).toBe(401)
    expect(r2.del).not.toHaveBeenCalled()
  })

  it('GET /api/scex-tracking strips hidden posts and admin fields', async () => {
    r2.getJson.mockResolvedValue({
      updatedAt: STAMP,
      config: { matrixTitle: 't' },
      actors: [
        {
          handle: 'a',
          scoreLog: 'secret',
          radarNote: 'n',
          trackingCode: 'x',
        },
      ],
      posts: [
        { id: '1', handle: 'a', hidden: true, notes: 'admin', text: 'hide' },
        { id: '2', handle: 'a', notes: 'keep-out', text: 'pub' },
      ],
    })
    const res = mockRes()
    await scexHandler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(200)
    const body = res.body as {
      posts: Record<string, unknown>[]
      actors: Record<string, unknown>[]
    }
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].notes).toBeUndefined()
    expect(body.posts[0].hidden).toBeUndefined()
    expect(body.actors[0].scoreLog).toBeUndefined()
    expect(body.actors[0].radarNote).toBeUndefined()
    expect(body.actors[0].trackingCode).toBeUndefined()
  })

  it('PUT /api/scex-tracking empty actors+posts → 400', async () => {
    const res = mockRes()
    await scexHandler(
      mockReq({
        method: 'PUT',
        headers: auth(),
        body: { config: {}, actors: [], posts: [] },
      }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('PUT /api/recent-followers empty map → 400', async () => {
    const res = mockRes()
    await followersHandler(
      mockReq({ method: 'PUT', headers: auth(), body: { map: {} } }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(r2.putJson).not.toHaveBeenCalled()
  })

  it('GET /api/kol-reports public drops private reports', async () => {
    r2.getJson.mockResolvedValue({
      updatedAt: STAMP,
      reports: [
        { id: '1', visibility: 'public', sourceFilename: 'a.docx', changelog: [1, 2, 3] },
        { id: '2', visibility: 'private', text: 'secret' },
      ],
    })
    const res = mockRes()
    await reportsHandler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(200)
    const body = res.body as { reports: { id: string; sourceFilename?: string }[] }
    expect(body.reports.map((r) => r.id)).toEqual(['1'])
    expect(body.reports[0].sourceFilename).toBeUndefined()
  })

  it('GET /api/kol-reports?all=1 without token → 401', async () => {
    const res = mockRes()
    await reportsHandler(mockReq({ method: 'GET', query: { all: '1' } }), res)
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/json?route=kols strips hidden (dispatcher)', async () => {
    r2.getJson.mockResolvedValue({
      updatedAt: STAMP,
      kols: [
        { id: 'a', handle: 'vis' },
        { id: 'b', handle: 'hid', hidden: true },
      ],
    })
    const res = mockRes()
    await jsonHandler(
      mockReq({ method: 'GET', query: { route: 'kols' } }),
      res,
    )
    expect(res.statusCode).toBe(200)
    const body = res.body as { kols: { handle: string }[] }
    expect(body.kols.map((k) => k.handle)).toEqual(['vis'])
  })

  it('GET /api/json unknown route → 404', async () => {
    const res = mockRes()
    await jsonHandler(
      mockReq({ method: 'GET', query: { route: 'not-a-route' } }),
      res,
    )
    expect(res.statusCode).toBe(404)
    expect(r2.getJson).not.toHaveBeenCalled()
  })
})
