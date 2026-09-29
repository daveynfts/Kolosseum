// Operator smoke test: one explicitly authorized Surf request. Never auto-repay.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { liveAccessMessage } from '../../lib/payments/reportAccessMessage'
import { PAY_RECEIPT_WRITEOUT, parsePayCliOutput } from '../../lib/payments/payCliOutput'
const base='https://surfai-api-production.up.railway.app/live/agent',folder='.demo-captures',file=folder+'/agent-live-order.json'
mkdirSync(folder,{recursive:true})
const action=process.argv[2]
if(!['prepare','probe','pay','claim','status','recover-rejected'].includes(action))throw new Error('Unknown action')
type Saved={id:string;token:string;gateway:string;requester:string;readerKey:number[];paymentAttempted?:boolean;receipt?:string}
let saved:Saved|undefined=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):undefined
if(action==='prepare'&&!saved){
  const pair=Keypair.generate(),wallet=pair.publicKey.toBase58(),at=new Date().toISOString()
  const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(pair.secretKey.slice(0,32))]),format:'der',type:'pkcs8'})
  const headers={'Content-Type':'application/json','X-Kolosseum-Wallet':wallet,'X-Kolosseum-Issued-At':at,'X-Kolosseum-Signature':bs58.encode(sign(null,Buffer.from(liveAccessMessage(wallet,at)),key))}
  const r=await fetch(base+'/orders',{method:'POST',headers,body:JSON.stringify({handle:'luong4101992'})});const data=await r.json();if(!r.ok)throw new Error(data.error)
  saved={...data,requester:wallet,readerKey:[...pair.secretKey]};writeFileSync(file,JSON.stringify(saved));
}
if(!saved)throw new Error('Prepare an order first')
const orderUrl=base+'/orders/'+saved.id,gateway=saved.gateway+'/live/agent/orders/'+saved.id+'/purchase'
async function status(){const r=await fetch(orderUrl,{signal:AbortSignal.timeout(20000),headers:{'X-Kolosseum-Agent':saved!.token}});const d=await r.json();if(!r.ok)throw new Error(d.error);return d}
if(action==='recover-rejected'){
  const current=await status(), response=JSON.parse(readFileSync(folder+'/agent-response.json','utf8'))
  if(current.status!=='prepared'||current.payment?.verified||saved.receipt||response.error!=='verification_failed'||response.message!=="credential's accepted does not match any offered currency option")throw new Error('Cannot recover an ambiguous or settled payment')
  writeFileSync(folder+'/agent-rejected-attempt.json',JSON.stringify({at:new Date().toISOString(),orderId:saved.id,response}))
  saved.paymentAttempted=false;writeFileSync(file,JSON.stringify(saved));console.log('Verified pre-settlement rejection recorded; recovery explicitly authorized by user.')
}else if(action==='probe'){
  const r=await fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:saved.token})});const body=await r.text();writeFileSync(folder+'/agent-challenge.json',body);console.log({status:r.status,challenge:body.slice(0,2500)});if(r.status!==402)process.exitCode=1
}else if(action==='pay'){
  const current=await status();if(current.status!=='prepared'||saved.paymentAttempted)throw new Error('Do not repay. Recover the existing order/receipt first.')
  const binary=process.env.PAY_BINARY||'pay'
  const version=spawnSync(binary,['--version'],{encoding:'utf8'});if(version.status!==0||version.stdout.trim()!=='pay 0.28.0')throw new Error('Install official Pay CLI 0.28.0, matching the gateway; set PAY_BINARY if needed')
  const challengeResponse=await fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:saved.token})})
  const challenge=JSON.parse(Buffer.from(challengeResponse.headers.get('payment-required')||'','base64').toString())
  const offered=challenge.accepts?.[0]
  if(challengeResponse.status!==402||challenge.accepts?.length!==1||offered.scheme!=='upto'||offered.amount!=='720000'||offered.network!=='solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'||offered.extra?.transactionVersions)throw new Error('Gateway challenge is not compatible with the approved 0.28.0 sandbox purchase')
  writeFileSync(folder+'/agent-challenge-verified.json',JSON.stringify({at:new Date().toISOString(),status:402,challenge},null,2))
  saved.paymentAttempted=true;writeFileSync(file,JSON.stringify(saved));writeFileSync(folder+'/agent-request.json',JSON.stringify({token:saved.token}))
  const env={...process.env};const pathKeys=Object.keys(env).filter(k=>k.toLowerCase()==='path');const previous=pathKeys.map(k=>env[k]).find(Boolean)||'';for(const k of pathKeys)delete env[k];env.Path='C:/Program Files/Git/usr/bin;'+previous
  const r=spawnSync(binary,['--sandbox','--no-dna','curl','-sS','-w',PAY_RECEIPT_WRITEOUT,'-X','POST','-H','Content-Type: application/json','--data-binary','@'+folder+'/agent-request.json',gateway],{encoding:'utf8',shell:false,env,timeout:120000})
  writeFileSync(folder+'/agent-payment.log',(r.stdout||'')+'\n'+(r.stderr||''))
  const parsed=parsePayCliOutput(r.stdout||'')
  if(parsed.orderId!==saved.id)throw new Error('Receipt response belongs to another order; do not repay')
  saved.receipt=parsed.receipt;writeFileSync(file,JSON.stringify(saved));writeFileSync(folder+'/agent-response.json',parsed.body)
  console.log({orderId:saved.id,exitCode:r.status,receiptSaved:true})
  if(r.status!==0)process.exitCode=1
}else if(action==='claim'){
  if(!saved.receipt)throw new Error('No saved settlement receipt. Do not purchase again.')
  const r=await fetch(orderUrl+'/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:saved.token,receipt:saved.receipt})});const data=await r.json();if(!r.ok)throw new Error(data.error)
  console.log({orderId:saved.id,status:data.status,payment:data.payment})
}else{
  const data=await status();console.log({orderId:saved.id,status:data.status,payment:data.payment,events:data.report?.eventCount,characters:data.report?.generatedCharacters,hash:data.report?.contentHash,error:data.report?.error})
  if(data.status==='ready'){writeFileSync(folder+'/agent-report.json',JSON.stringify(data,null,2));console.log('Saved authenticated report privately for review.')}
}
