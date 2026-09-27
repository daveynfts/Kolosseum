import type { IncomingMessage, ServerResponse } from 'node:http'
import { createNftQuote, listNftPurchases, nftStorageConfigured, premiumReport, refreshNftPurchase, submitNftPurchase } from './reportNft'
import { verifyDashboardAccess } from './walletAccess'

export async function nftRoutes(req: IncomingMessage, res: ServerResponse, pathname: string, readJson: (req: IncomingMessage) => Promise<Record<string, unknown>>, send: (res: ServerResponse, status: number, value: unknown) => void) {
  if (!pathname.startsWith('/nft/')) return false
  if (process.env.SURF_NFT_ENABLED !== 'true') { send(res, 404, { error: 'NFT checkout is disabled' }); return true }
  try {
    if (pathname === '/nft/catalog' && req.method === 'GET') {
      const report = await premiumReport()
      const { content: _content, ...catalog } = report
      send(res, 200, { ...catalog, network: 'devnet', storageConfigured: await nftStorageConfigured(), preparedEdition: true })
      return true
    }
    const buyer = verifyDashboardAccess(req.headers)
    if (!buyer) { send(res, 401, { error: 'A recent wallet signature is required' }); return true }
    if (pathname === '/nft/purchases' && req.method === 'GET') { send(res, 200, { purchases: await listNftPurchases(buyer) }); return true }
    if (pathname === '/nft/quotes' && req.method === 'POST') { send(res, 200, await createNftQuote(buyer)); return true }
    const match = /^\/nft\/purchases\/([0-9a-f-]{36})(\/submit)?$/.exec(pathname)
    if (match && req.method === 'GET' && !match[2]) { send(res, 200, await refreshNftPurchase(match[1], buyer)); return true }
    if (match && req.method === 'POST' && match[2]) {
      const body = await readJson(req)
      if (typeof body.transaction !== 'string') throw new Error('Invalid signed transaction')
      send(res, 200, await submitNftPurchase(match[1], buyer, body.transaction)); return true
    }
    send(res, 404, { error: 'NFT route not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const safe = /^(Invalid |Signed transaction|Quote |Purchase not found|Insufficient Devnet|Use a buyer|SOL\/USD|Publish the report|Hosted NFT|Public NFT|This checkout|Devnet treasury|Unable to estimate)/.test(message)
    send(res, safe ? 400 : 503, { error: safe ? message : 'NFT checkout is not ready. Please try again later.' })
  }
  return true
}
