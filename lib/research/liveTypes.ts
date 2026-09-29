export const LIVE_TIERS = { low: 50, medium: 120, high: 150, xhigh: 200 } as const
export type LiveEffort = keyof typeof LIVE_TIERS
export type ViewPolicy = 'author' | 'holders' | 'allowlist' | 'public'
export type LivePolicy = { view: ViewPolicy; viewers: string[]; allowTransfers: boolean }
export type LiveQuote = { lamports: string; usdMicros: number; solUsdMicros: number; rateAsOf: string; recipient: string; expiresAt: string; blockhash: string; lastValidBlockHeight: number; networkFeeLamports: number }
export type LiveJobView = {
  id: string; handle: string; author: string; effort: LiveEffort; credits: number; status: string
  policy: LivePolicy; quote: LiveQuote; signature: string | null; transaction?: string
  content?: string; contentHash: string | null; snapshotAt: string; sampledPosts: number
  asset: string | null; owner?: string; transfersAllowed?: boolean; canManage: boolean
  eventCount: number; generatedCharacters: number; error: string | null; createdAt: string
  paymentKind?: 'sol-devnet' | 'x402-sandbox'
}
