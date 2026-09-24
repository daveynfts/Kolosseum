import bs58 from 'bs58'

// Values and byte offsets are from pay.sh's payment-channel account layout.
const CHANNEL_PROGRAM = 'CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const CHANNEL_LENGTH = 216

type JsonObject = Record<string, unknown>

function decodedHeader(value: string): JsonObject {
  if (!/^[A-Za-z0-9_-]{1,4096}$/.test(value)) throw new Error('Invalid payment receipt encoding')
  const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Invalid payment receipt body')
  }
  return decoded as JsonObject
}

function usdcBaseUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value)) {
    throw new Error('Invalid receipt amount')
  }
  return BigInt(value)
}

function address(value: unknown): string {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) {
    throw new Error('Invalid receipt address')
  }
  const bytes = bs58.decode(value)
  if (bytes.length !== 32 || bs58.encode(bytes) !== value) throw new Error('Invalid receipt address')
  return value
}

function signature(value: unknown): string {
  if (typeof value !== 'string' || value.length < 64 || value.length > 88) {
    throw new Error('Invalid receipt transaction')
  }
  const bytes = bs58.decode(value)
  if (bytes.length !== 64 || bs58.encode(bytes) !== value) throw new Error('Invalid receipt transaction')
  return value
}

export type MppReceipt = {
  channelId: string
  amount: bigint
  spent: bigint
  authorized: bigint
  remaining: bigint
}

export function parseMppReceipt(header: string): MppReceipt {
  const data = decodedHeader(header)
  if (data.status !== 'success' || data.intent !== 'session' || data.method !== 'solana' ||
      data.network !== 'localnet' || data.currency !== USDC_MINT) {
    throw new Error('Unsupported MPP receipt')
  }
  const amount = usdcBaseUnits(data.amount)
  const spent = usdcBaseUnits(data.spent)
  const accepted = usdcBaseUnits(data.acceptedCumulative)
  const authorized = usdcBaseUnits(data.authorized)
  const remaining = usdcBaseUnits(data.remaining)
  if (amount === 0n || spent !== accepted || spent > authorized ||
      remaining !== authorized - spent || amount > spent) {
    throw new Error('Inconsistent MPP receipt')
  }
  return { channelId: address(data.reference), amount, spent, authorized, remaining }
}

export type X402Receipt = {
  payer: string
  transaction: string
  amount: bigint
}

export function parseX402Receipt(header: string): X402Receipt {
  const data = decodedHeader(header)
  if (data.success !== true || data.network !== 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1') {
    throw new Error('Unsupported x402 sandbox receipt')
  }
  const amount = usdcBaseUnits(data.amount)
  if (amount === 0n) throw new Error('Invalid receipt amount')
  return { payer: address(data.payer), transaction: signature(data.transaction), amount }
}

async function rpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error('Sandbox RPC unavailable')
  const body = await response.json() as { result?: T; error?: unknown }
  if (body.error || body.result === undefined) throw new Error('Sandbox RPC rejected request')
  return body.result
}

type AccountInfo = { value: { owner: string; data: [string, string] } | null }

export type VerifiedChannel = {
  channelId: string
  status: 'open' | 'sealed' | 'closing' | 'distributed'
  payer: string
  payee: string
  capBaseUnits: bigint
  settledBaseUnits: bigint
  remainingBaseUnits: bigint
  receiptAmountBaseUnits: bigint
  receiptSpentBaseUnits: bigint
  receiptSettledOnChain: boolean
}

export async function inspectMppReceipt(input: {
  receipt: string
  rpcUrl: string
  expectedPayer: string
  expectedPayee: string
}): Promise<VerifiedChannel> {
  const receipt = parseMppReceipt(input.receipt)
  const result = await rpc<AccountInfo>(input.rpcUrl, 'getAccountInfo', [
    receipt.channelId, { encoding: 'base64', commitment: 'confirmed' },
  ])
  if (!result.value || result.value.owner !== CHANNEL_PROGRAM || result.value.data[1] !== 'base64') {
    throw new Error('Payment channel not found')
  }
  const bytes = Buffer.from(result.value.data[0], 'base64')
  if (bytes.length < CHANNEL_LENGTH) throw new Error('Invalid payment channel account')
  const status = (['open', 'sealed', 'closing', 'distributed'] as const)[bytes[3]]
  if (!status) throw new Error('Unknown payment channel status')
  const capBaseUnits = bytes.readBigUInt64LE(12)
  const settledBaseUnits = bytes.readBigUInt64LE(20)
  const payer = bs58.encode(bytes.subarray(88, 120))
  const payee = bs58.encode(bytes.subarray(120, 152))
  const mint = bs58.encode(bytes.subarray(184, 216))
  if (payer !== address(input.expectedPayer) || payee !== address(input.expectedPayee) ||
      mint !== USDC_MINT || capBaseUnits !== receipt.authorized || settledBaseUnits > capBaseUnits) {
    throw new Error('Payment channel does not match receipt or buyer')
  }
  return {
    channelId: receipt.channelId, status, payer, payee, capBaseUnits, settledBaseUnits,
    remainingBaseUnits: capBaseUnits - settledBaseUnits,
    receiptAmountBaseUnits: receipt.amount, receiptSpentBaseUnits: receipt.spent,
    receiptSettledOnChain: settledBaseUnits >= receipt.spent,
  }
}

type TokenBalance = {
  accountIndex: number
  owner?: string
  mint: string
  uiTokenAmount: { amount: string }
}
type ParsedTransaction = {
  slot: number
  meta: { err: unknown; preTokenBalances: TokenBalance[]; postTokenBalances: TokenBalance[] }
  transaction: { message: { accountKeys: Array<{ pubkey: string }>; instructions: Array<{ programId: string }> } }
}

function ownerBalance(balances: TokenBalance[], owner: string): bigint {
  return balances.reduce((total, item) =>
    total + (item.owner === owner && item.mint === USDC_MINT ? usdcBaseUnits(item.uiTokenAmount.amount) : 0n), 0n)
}

export async function inspectX402Receipt(input: {
  receipt: string
  rpcUrl: string
  expectedPayer: string
  expectedPayee: string
  expectedChannelPayee: string
}): Promise<X402Receipt & { slot: number; settledOnChain: true }> {
  const receipt = parseX402Receipt(input.receipt)
  if (receipt.payer !== address(input.expectedPayer)) throw new Error('x402 payer does not match buyer')
  const result = await rpc<ParsedTransaction | null>(input.rpcUrl, 'getTransaction', [
    receipt.transaction, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  ])
  const payee = address(input.expectedPayee)
  if (!result || result.meta.err !== null ||
      !result.transaction.message.instructions.some((instruction) => instruction.programId === CHANNEL_PROGRAM) ||
      !result.transaction.message.accountKeys.some((account) => account.pubkey === receipt.payer) ||
      !result.transaction.message.accountKeys.some((account) => account.pubkey === payee)) {
    throw new Error('x402 settlement transaction is invalid')
  }
  const keys = result.transaction.message.accountKeys.map((account) => account.pubkey)
  const accounts = await rpc<{ value: Array<{ owner: string; data: [string, string] } | null> }>(
    input.rpcUrl, 'getMultipleAccounts', [keys, { encoding: 'base64', commitment: 'confirmed' }],
  )
  const matchingChannel = accounts.value.some((account) => {
    if (!account || account.owner !== CHANNEL_PROGRAM || account.data[1] !== 'base64') return false
    const bytes = Buffer.from(account.data[0], 'base64')
    return bytes.length >= CHANNEL_LENGTH &&
      bs58.encode(bytes.subarray(88, 120)) === receipt.payer &&
      bs58.encode(bytes.subarray(120, 152)) === address(input.expectedChannelPayee) &&
      bs58.encode(bytes.subarray(184, 216)) === USDC_MINT &&
      bytes.readBigUInt64LE(20) === receipt.amount
  })
  if (!matchingChannel) throw new Error('x402 channel payer or settlement does not match receipt')
  const delta = ownerBalance(result.meta.postTokenBalances || [], payee) -
    ownerBalance(result.meta.preTokenBalances || [], payee)
  if (delta !== receipt.amount) throw new Error('x402 settlement amount does not match receipt')
  return { ...receipt, slot: result.slot, settledOnChain: true }
}
