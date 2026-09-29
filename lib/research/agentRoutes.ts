import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyLiveAccess } from '../payments/walletAccess'
import { acceptAgentPurchase, agentGatewayAuthorized, agentOrderStatus, createAgentOrder, settleAgentOrder } from './agentOrders'
export async function agentRoutes(req: IncomingMessage,res: ServerResponse,path: string,read: (req: IncomingMessage)=>Promise<Record<string,unknown>>,send:(res:ServerResponse,status:number,value:unknown)=>void) {
  if (!path.startsWith('/live/agent/')) return false
  if (process.env.AGENT_X402_ENABLED !== 'true') {send(res,503,{error:'Agent x402 sandbox is not enabled'});return true}
  try {
    if (path==='/live/agent/config' && req.method==='GET') {send(res,200,{enabled:true,priceUsdc:'0.72',credits:120,effort:'medium',protocol:'x402-upto',network:'Surfpool/localnet'});return true}
    const wallet=verifyLiveAccess(req.headers)
    if (path==='/live/agent/orders' && req.method==='POST') {
      if(!wallet) {send(res,401,{error:'Connect and sign in to prepare an agent order'});return true}
      const body=await read(req);send(res,200,await createAgentOrder(wallet,String(body.handle||'')));return true
    }
    const match=/^\/live\/agent\/orders\/([0-9a-f-]{36})(?:\/(purchase|receipt))?$/.exec(path)
    if(match && req.method==='GET' && !match[2]) {send(res,200,await agentOrderStatus(match[1],req.headers['x-kolosseum-agent'],wallet||undefined));return true}
    if(match && req.method==='POST') {
      if(match[2]==='purchase' && !agentGatewayAuthorized(req.headers['x-kolosseum-agent-gateway'])) {send(res,403,{error:'Use the x402 gateway URL for payment'});return true}
      const body=await read(req)
      if(match[2]==='purchase') {send(res,200,await acceptAgentPurchase(match[1],body.token));return true}
      if(match[2]==='receipt') {if(typeof body.receipt!=='string'||body.receipt.length>4096) throw new Error('Invalid receipt');send(res,200,await settleAgentOrder(match[1],body.token,body.receipt));return true}
    }
    send(res,404,{error:'Agent route not found'})
  } catch(e) {
    const msg=e instanceof Error?e.message:''
    const safe=/^(Agent (access denied|order|receipt)|Invalid |Unsupported x402|x402 |No source posts|KOL not found)/.test(msg)
    send(res,safe?400:503,{error:safe?msg:'Agent service unavailable. Keep the order ID and receipt; do not pay again.'})
  }
  return true
}
