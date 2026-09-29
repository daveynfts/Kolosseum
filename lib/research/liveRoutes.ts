import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyLiveAccess } from '../payments/walletAccess'
import { liveCatalog, liveLibrary, liveMetadata, liveView, prepareLiveOperation, quoteLive, reconcileLiveOperation, submitLiveOperation, submitLivePayment, updateLiveViewing } from './liveService'
export async function liveRoutes(req: IncomingMessage, res: ServerResponse, path: string, read: (req: IncomingMessage) => Promise<Record<string, unknown>>, send: (res: ServerResponse, status: number, value: unknown) => void) {
  if (!path.startsWith('/live/')) return false
  res.setHeader('Cache-Control', 'no-store')
  if (process.env.SURF_LIVE_ENABLED !== 'true') { send(res, 503, { error: 'Live research is not enabled on this backend' }); return true }
  try {
    const wallet = verifyLiveAccess(req.headers)
    const url = new URL(req.url || path, 'http://localhost')
    if (path === '/live/catalog' && req.method === 'GET') { send(res, 200, await liveCatalog(url.searchParams.get('handle') || '')); return true }
    const match = /^\/live\/reports\/([0-9a-f-]{36})(?:\/(metadata|payment|viewing|operations))?$/.exec(path)
    if (match?.[2] === 'metadata' && req.method === 'GET') { send(res, 200, await liveMetadata(match[1])); return true }
    if (match && !match[2] && req.method === 'GET') { send(res, 200, await liveView(match[1], wallet)); return true }
    if (!wallet) { send(res, 401, { error: 'Sign in with your wallet to continue' }); return true }
    if (path === '/live/library' && req.method === 'GET') { send(res, 200, { reports: await liveLibrary(wallet) }); return true }
    if (path === '/live/quotes' && req.method === 'POST') { send(res, 200, await quoteLive(wallet, await read(req))); return true }
    if (match && req.method === 'POST') {
      const input = await read(req)
      if (match[2] === 'payment') { if (typeof input.transaction !== 'string') throw new Error('Invalid signed transaction'); send(res, 200, await submitLivePayment(match[1], wallet, input.transaction)); return true }
      if (match[2] === 'viewing') { send(res, 200, await updateLiveViewing(match[1], wallet, input.policy)); return true }
      if (match[2] === 'operations') {
        if (!['mint', 'transfer_policy', 'transfer', 'refund'].includes(String(input.kind))) throw new Error('Invalid operation')
        send(res, 200, await prepareLiveOperation(match[1], wallet, input.kind as 'mint' | 'transfer_policy' | 'transfer' | 'refund', input)); return true
      }
    }
    const operation = /^\/live\/operations\/([0-9a-f-]{36})$/.exec(path)
    if (operation && req.method === 'GET') { send(res, 200, await reconcileLiveOperation(operation[1], wallet)); return true }
    if (operation && req.method === 'POST') { const input = await read(req); if (typeof input.transaction !== 'string') throw new Error('Invalid signed transaction'); send(res, 200, await submitLiveOperation(operation[1], wallet, input.transaction)); return true }
    send(res, 404, { error: 'Live research route not found' })
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    const safe = /^(Invalid |KOL not found|Valid buyerWallet|Only the report author|Report (not found|access denied|is not ready|NFT already)|No (source posts|confirmed payment)|Quote expired|Operation (not found|quote expired|changed)|NFT (transfer|report binding)|Mint the report|Another NFT|Use a buyer|Publish the backend|Payment (changed|is not finalized)|Already refunded|SOL\/USD)/.test(message)
    send(res, safe ? 400 : 503, { error: safe ? message : 'Live research is temporarily unavailable. Existing payments remain recorded; recover your report before paying again.' })
  }
  return true
}
