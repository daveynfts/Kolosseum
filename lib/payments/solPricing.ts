export const CREDIT_USD_MICROS = 6_000
export function priceInLamports(credits: number, solUsdMicros: number): string {
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 200) throw new Error('Invalid credit quantity')
  if (!Number.isSafeInteger(solUsdMicros) || solUsdMicros < 1_000_000 || solUsdMicros > 1_000_000_000_000) throw new Error('Invalid SOL/USD price')
  const numerator = BigInt(credits) * BigInt(CREDIT_USD_MICROS) * 1_000_000_000n
  return ((numerator + BigInt(solUsdMicros) - 1n) / BigInt(solUsdMicros)).toString()
}
export function validateSolRate(data: unknown, now = Date.now()) {
  const value = (data as { solana?: { usd?: number; last_updated_at?: number } })?.solana
  if (!value || typeof value.usd !== 'number' || typeof value.last_updated_at !== 'number' || !Number.isFinite(value.usd) || !Number.isFinite(value.last_updated_at)) throw new Error('SOL/USD quote unavailable')
  const asOf = value.last_updated_at * 1000
  if (asOf > now + 30_000 || now - asOf > 180_000) throw new Error('SOL/USD quote is stale')
  const usdMicros = Math.round(value.usd * 1_000_000)
  priceInLamports(1, usdMicros)
  return { usdMicros, asOf: new Date(asOf).toISOString(), source: 'CoinGecko SOL/USD' }
}
let cached: { at: number; value: ReturnType<typeof validateSolRate> } | undefined
export async function fetchSolRate() {
  if (cached && Date.now() - cached.at < 30_000 && Date.now() - Date.parse(cached.value.asOf) < 150_000) return cached.value
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_last_updated_at=true', { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error('SOL/USD quote unavailable; try again later')
  const value = validateSolRate(await response.json())
  cached = { at: Date.now(), value }
  return value
}
