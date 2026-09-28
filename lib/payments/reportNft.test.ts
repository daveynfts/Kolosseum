import { describe, expect, it } from 'vitest'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { assertSignedQuote } from './reportNft'
describe('exact NFT purchase transaction validation', () => {
  const buyer = Keypair.generate(), recipient = Keypair.generate().publicKey
  function transaction(amount = 8_000_000) {
    return new Transaction({ feePayer: buyer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(SystemProgram.transfer({ fromPubkey: buyer.publicKey, toPubkey: recipient, lamports: amount }))
  }
  it('accepts the exact buyer-signed quote', () => {
    const tx = transaction(), expected = tx.serialize({ requireAllSignatures: false }).toString('base64')
    tx.sign(buyer)
    expect(assertSignedQuote(tx.serialize().toString('base64'), expected, buyer.publicKey.toBase58()).signature).toBeTruthy()
  })
  it('rejects substituted recipients, prices, buyers, instructions and missing signatures', () => {
    const tx = transaction(), expected = tx.serialize({ requireAllSignatures: false }).toString('base64')
    expect(() => assertSignedQuote(expected, expected, buyer.publicKey.toBase58())).toThrow()
    tx.sign(buyer)
    expect(() => assertSignedQuote(tx.serialize().toString('base64'), expected, recipient.toBase58())).toThrow()
    const altered = Transaction.from(tx.serialize()); altered.add(SystemProgram.transfer({ fromPubkey: buyer.publicKey, toPubkey: recipient, lamports: 1 })); altered.sign(buyer)
    expect(() => assertSignedQuote(altered.serialize().toString('base64'), expected, buyer.publicKey.toBase58())).toThrow()
    const cheap = transaction(1); cheap.sign(buyer)
    expect(() => assertSignedQuote(cheap.serialize().toString('base64'), expected, buyer.publicKey.toBase58())).toThrow()
  })
})
