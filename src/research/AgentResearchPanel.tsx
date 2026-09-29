import { useEffect, useRef, useState } from 'react'
import { useKolosseumWallet } from './useKolosseumWallet'
import { researchApi } from './api'
import { PremiumReportBody } from './PremiumReportBody'
import type { LiveJobView } from '../../lib/research/liveTypes'
type Order = { id:string; token:string; handle:string; gateway:string; apiBase?:string; sampledPosts:number }
type Status = { expiresAt?:string; status:string; payment:{verified:boolean;payer:string|null;transaction:string|null};report:LiveJobView|null }
async function call<T>(path:string,headers:Record<string,string>={},body?:unknown):Promise<T> {
  const r=await fetch(researchApi('/live/agent'+path),{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
  const data=await r.json();if(!r.ok) throw new Error(data.error||'Agent service unavailable');return data
}
export function AgentResearchPanel({handle}:{handle:string}) {
  const wallet=useKolosseumWallet(),[order,setOrder]=useState<Order|null>(null),[status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[receipt,setReceipt]=useState(''),[claiming,setClaiming]=useState(false)
  const scope=`${wallet.address||''}:${handle}`,scopeRef=useRef(scope);scopeRef.current=scope
  const key='kolosseum.agent.'+scope
  useEffect(()=>{setOrder(null);setStatus(null);setError('');setReceipt('');setCopied(false);try{const saved=sessionStorage.getItem(key);if(saved)setOrder(JSON.parse(saved))}catch{/* recover by wallet through My Reports */}},[key])
  useEffect(()=>{
    if(!order)return
    let active=true,inflight=false
    async function poll(){if(inflight)return;inflight=true;try{const next=await call<Status>('/orders/'+order!.id,{'X-Kolosseum-Agent':order!.token});if(next.report?.content){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(next.report.content));if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==next.report.contentHash)throw new Error('Report integrity check failed')}if(active){setStatus(next);setError('')}}catch(e){if(active)setError(e instanceof Error?e.message:'Status unavailable')}finally{inflight=false}}
    void poll();const timer=setInterval(()=>{if(!document.hidden)void poll()},5000)
    return()=>{active=false;clearInterval(timer)}
  },[order])
  async function prepare(){if(busy)return;setBusy(true);setError('');const initial=scopeRef.current;try{const headers=await wallet.signLiveAccess();if(initial!==scopeRef.current)return;const next=await call<Order>('/orders',headers,{handle});if(initial!==scopeRef.current)return;setOrder(next);try{sessionStorage.setItem(key,JSON.stringify(next))}catch{/* Continue without persistence. */}}catch(e){if(initial===scopeRef.current)setError(e instanceof Error?e.message:'Could not prepare order')}finally{setBusy(false)}}
  async function recoverReceipt(){
    if(!order||claiming||!receipt.trim())return
    const initial=scopeRef.current;setClaiming(true);setError('')
    try{const next=await call<Status>('/orders/'+order.id+'/receipt',{}, {token:order.token,receipt:receipt.trim()});if(initial===scopeRef.current){setStatus({...next,report:null});setReceipt('')}}catch(e){if(initial===scopeRef.current)setError(e instanceof Error?e.message:'Could not verify receipt. Do not pay again.')}finally{setClaiming(false)}
  }
  const expired=status?.status==='prepared'&&!!status.expiresAt&&Date.parse(status.expiresAt)<=Date.now()
  const apiBase=order?.apiBase || 'https://surfai-api-production.up.railway.app/live/agent'
  const prompt=order?`Use Pay CLI 0.28.0 with pay.sh sandbox to purchase ONE Kolosseum medium research report for @${order.handle}. This spends 0.72 test USDC and triggers one real Surf request (120 credits). Do not use mainnet.\nOrder ID: ${order.id}\nOrder capability (keep private): ${order.token}\nFirst GET ${apiBase}/orders/${order.id} with header X-Kolosseum-Agent: ${order.token}. If payment is already verified, only poll status; do not purchase again. If status is accepted, recover the saved PAYMENT-RESPONSE receipt; do not blindly retry payment.\nFor a fresh prepared order, call pay --sandbox curl on ${order.gateway}/live/agent/orders/${order.id}/purchase with POST JSON {"token":"${order.token}"}. Pay overrides curl -D/-o. Instead add curl --write-out with the exact format KOLOSSEUM_RECEIPT:%header{payment-response} preceded and followed by a newline. Capture stdout to a private file; it contains the JSON body followed by the receipt marker. Only accept an x402 challenge capped at 0.72 test USDC.\nAfter a successful purchase, extract the PAYMENT-RESPONSE value after the KOLOSSEUM_RECEIPT: marker and POST {"token":"${order.token}","receipt":"<exact header value>"} to ${apiBase}/orders/${order.id}/receipt using ordinary HTTP (no second payment). If settlement is not indexed yet, retry ONLY this receipt submission.\nPoll the original order every 10 seconds for up to 35 minutes, using the capability header. Return its reportUrl, payment transaction and report SHA-256. Do not create another order or call Surf directly. The sandbox payer is the report author; the website wallet is an invited reader. NFT minting is a separate Devnet action requiring the author wallet.`:''
  return <section className="live-agent" aria-label="Use with an agent">
    <h4>Use with an agent</h4><p>Let your agent buy this research through x402. Medium · 120 credits · <b>0.72 test USDC</b>.</p>
    <p>Sandbox payment uses Surfpool/localnet. Research uses real Surf credits. Your connected wallet receives reading access; the paying agent wallet is the author. NFT actions use Solana Devnet separately.</p>
    {!order?<button disabled={busy||!wallet.address} onClick={()=>void prepare()}>{busy?'Preparing…':'Prepare agent prompt'}</button>:<>
      <p>Order <code>{order.id}</code> · {order.sampledPosts} source posts</p>
      <label>Private agent prompt<textarea readOnly value={prompt} rows={7}/></label>
      <button onClick={()=>void navigator.clipboard.writeText(prompt).then(()=>setCopied(true)).catch(()=>setError('Copy unavailable. Select the prompt text manually.'))}>{copied?'Copied':'Copy agent prompt'}</button>
      <p>Start your agent with <code>pay --sandbox claude</code>, then paste this prompt. Keep the capability private.</p>
      <ol aria-label="Agent progress"><li>Order prepared</li><li>{status?.payment.verified?'Payment verified':status?.status==='accepted'?'Gateway accepted · awaiting settlement receipt':'Waiting for agent payment'}</li><li>{status?.status==='ready'?'Report ready':status?.status==='running'?'Surf is researching…':status?.status==='queued'?'Research queued':status?.status==='failed'?'Research failed · no automatic paid retry':'Research not started'}</li></ol>
      {expired&&<p role="status">This unpaid order has expired. Prepare a new order before sending an agent.</p>}
      {expired&&<button disabled={busy} onClick={()=>void prepare()}>Prepare a new agent order</button>}
      {status?.status==='accepted'&&!status.payment.verified&&<details><summary>Recover an existing payment</summary><p>Paste the saved PAYMENT-RESPONSE value. Verification starts one real Surf request (120 credits); it does not make another payment. If verification is temporarily unavailable, keep this receipt and retry verification only.</p><label>Settlement receipt<textarea value={receipt} onChange={e=>setReceipt(e.target.value)} maxLength={4096} autoComplete="off" spellCheck={false}/></label><button disabled={claiming||!receipt.trim()} onClick={()=>void recoverReceipt()}>{claiming?'Verifying…':'Verify receipt & continue research'}</button></details>}
      {status?.status==='running'&&<p role="status">Research can take up to 30 minutes. {status.report?.eventCount||0} progress events received. You can close this workspace and return later.</p>}
      {status?.payment.transaction&&<details><summary>x402 settlement receipt</summary><p>Network: Surfpool/localnet (sandbox)</p><p>Payer: <code>{status.payment.payer}</code></p><p>Transaction: <code>{status.payment.transaction}</code></p></details>}
      {status?.report?.content&&<><PremiumReportBody content={status.report.content}/><details><summary>Report SHA-256</summary><code>{status.report.contentHash}</code></details></>}
      {status?.status==='failed'&&<p>Keep this order ID for support. The payment used test USDC; no Devnet SOL refund applies.</p>}
    </>}
    {error&&<p role="alert" className="live-error">{error}</p>}
  </section>
}
