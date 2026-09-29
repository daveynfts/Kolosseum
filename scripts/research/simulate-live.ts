import { config } from 'dotenv'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import { liveAssetTransaction, liveOperator } from '../../lib/research/liveChain'
import { devnet } from '../../lib/payments/reportNft'
config({ path: '.env.local', quiet: true })
const connection = await devnet(), wallet = (await liveOperator()).publicKey.toBase58(), latest = await connection.getLatestBlockhash()
for (const scenario of ['frozen-transfer', 'thawed-transfer'] as const) {
  const built = liveAssetTransaction({ rpc: connection.rpcEndpoint, wallet, blockhash: latest.blockhash, id: '00000000-0000-4000-8000-000000000003', kind: 'mint', hash: 'a'.repeat(64), author: wallet, handle: 'helenvn88', uri: 'https://example.com/live-metadata', allowTransfers: false })
  if (scenario === 'thawed-transfer') {
    const thaw = liveAssetTransaction({ rpc: connection.rpcEndpoint, wallet, blockhash: latest.blockhash, id: 'simulation', kind: 'transfer_policy', hash: 'a'.repeat(64), asset: built.asset, author: wallet, handle: 'helenvn88', allowTransfers: true })
    built.tx.add(...thaw.tx.instructions)
  }
  const transfer = liveAssetTransaction({ rpc: connection.rpcEndpoint, wallet, blockhash: latest.blockhash, id: 'simulation', kind: 'transfer', hash: 'a'.repeat(64), asset: built.asset, author: wallet, handle: 'helenvn88', allowTransfers: true, recipient: Keypair.generate().publicKey.toBase58() })
  built.tx.add(...transfer.tx.instructions)
  const encoded = built.tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  const simulation = await connection.simulateTransaction(VersionedTransaction.deserialize(encoded), { sigVerify: false, commitment: 'confirmed' })
  if (scenario === 'frozen-transfer' ? !simulation.value.err : !!simulation.value.err) throw new Error(JSON.stringify({ scenario, error: simulation.value.err, logs: simulation.value.logs }))
  console.log(JSON.stringify({ scenario, status: 'PASS', error: simulation.value.err, computeUnits: simulation.value.unitsConsumed, broadcast: false }))
}
