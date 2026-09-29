import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import pg from 'pg'
import { Keypair } from '@solana/web3.js'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
config({path:'.env.local',quiet:true})
const url=process.env.TEST_DATABASE_URL
if(url&&new URL(url).pathname!=='/kolosseum_test')throw new Error('Isolated test database required')
const mock=vi.hoisted(()=>({inspect:vi.fn(),parsed:{payer:'',amount:720000n,transaction:'sandbox-test-signature'}}))
vi.mock('../payments/receipt',()=>({parseX402Receipt:()=>mock.parsed,inspectX402Receipt:mock.inspect}))
vi.mock('./kolContext',()=>({loadKolContext:async()=>({actor:{handle:'luong4101992'},posts:[{url:'https://x.com/luong4101992/status/1',text:'Test'}],source:{scexAsOf:'2026-09-20'}})}))
let db:typeof import('./db'),api:typeof import('./agentOrders'),admin:pg.Pool
const schema='agent_test_'+randomUUID().replaceAll('-',''),requester=Keypair.generate().publicKey.toBase58(),payer=Keypair.generate().publicKey.toBase58()
describe.skipIf(!url)('agent payment lifecycle (isolated schema; no paid API or chain writes)',()=>{
  beforeAll(async()=>{
    admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`)
    const scoped=new URL(url!);scoped.searchParams.set('options','-c search_path='+schema)
    vi.stubEnv('DATABASE_URL',scoped.toString());vi.stubEnv('SURF_API_KEY','test-key');vi.stubEnv('REPORT_ENC_KEY','ab'.repeat(32));vi.stubEnv('AGENT_GATEWAY_URL','https://gateway.example.com');vi.stubEnv('AGENT_PAYEE',payer);vi.stubEnv('AGENT_CHANNEL_PAYEE',payer);vi.stubEnv('AGENT_ORIGIN_TOKEN','test-'.repeat(12))
    db=await import('./db');api=await import('./agentOrders')
    await db.getPool().query('CREATE TABLE dr_reports(id uuid,payment_ref text)')
    for(const file of ['0003_live_research.sql','0004_agent_orders.sql'])await db.getPool().query(readFileSync(new URL('../../dr_migrations/'+file,import.meta.url),'utf8'))
    mock.parsed.payer=payer;mock.inspect.mockResolvedValue({...mock.parsed,settledOnChain:true,slot:1})
  },30000)
  afterAll(async()=>{if(db)await db.getPool().end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}vi.unstubAllEnvs()},30000)
  it('requires gateway authorization, capability and verified settlement before creating one job',async()=>{
    expect(api.agentGatewayAuthorized('fake')).toBe(false);expect(api.agentGatewayAuthorized('test-'.repeat(12))).toBe(true)
    const a=await api.createAgentOrder(requester,'luong4101992')
    await expect(api.acceptAgentPurchase(a.id,'wrong')).rejects.toThrow('access denied')
    await expect(api.settleAgentOrder(a.id,a.token,'receipt')).rejects.toThrow('not passed')
    await api.acceptAgentPurchase(a.id,a.token)
    expect((await db.getPool().query('SELECT * FROM dr_live_jobs')).rowCount).toBe(0)
    mock.inspect.mockRejectedValueOnce(new Error('x402 settlement transaction is invalid'))
    await expect(api.settleAgentOrder(a.id,a.token,'forged')).rejects.toThrow('invalid')
    expect((await db.getPool().query('SELECT * FROM dr_live_jobs')).rowCount).toBe(0)
    const [one,two]=await Promise.all([api.settleAgentOrder(a.id,a.token,'valid'),api.settleAgentOrder(a.id,a.token,'valid')])
    expect(one.id).toBe(two.id);expect(one.status).toBe('queued');expect(one.payment.verified).toBe(true)
    const rows=(await db.getPool().query('SELECT * FROM dr_live_jobs')).rows
    expect(rows).toHaveLength(1);expect(rows[0].author_wallet).toBe(payer);expect(rows[0].policy.viewers).toEqual([requester]);expect(rows[0].payment_kind).toBe('x402-sandbox')
    await expect(api.agentOrderStatus(a.id,'wrong')).rejects.toThrow('access denied')
    expect((await api.agentOrderStatus(a.id,undefined,requester)).payment.payer).toBe(payer)
    const b=await api.createAgentOrder(requester,'luong4101992');await api.acceptAgentPurchase(b.id,b.token)
    await expect(api.settleAgentOrder(b.id,b.token,'replayed')).rejects.toThrow('already used')
    expect((await db.getPool().query('SELECT * FROM dr_live_jobs')).rowCount).toBe(1)
  },30000)
})
