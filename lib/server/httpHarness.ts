import type { VercelRequest, VercelResponse } from '@vercel/node'

type MockRes = VercelResponse & {
  statusCode: number
  body: unknown
  headers: Record<string, string>
}

export function mockReq(init: {
  method: string
  query?: Record<string, string | string[]>
  body?: unknown
  headers?: Record<string, string>
}): VercelRequest {
  const headers: Record<string, string> = { ...(init.headers || {}) }
  return {
    method: init.method,
    query: init.query || {},
    body: init.body,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as VercelRequest
}

export function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    end() {
      return this
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value
    },
  }
  return res as MockRes
}

export const ADMIN = 'test-admin-token'
