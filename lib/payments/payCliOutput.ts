// Pay overrides curl -D/-o. curl's write-out survives the wrapper and preserves the receipt.
export const PAY_RECEIPT_WRITEOUT = '\nKOLOSSEUM_RECEIPT:%header{payment-response}\n'
export function parsePayCliOutput(stdout: string) {
  const match = /\r?\nKOLOSSEUM_RECEIPT:([^\r\n]*)\r?\n?$/.exec(stdout)
  if (!match) throw new Error('Missing payment receipt marker; recover the existing payment, never repay')
  const receipt = match[1].trim()
  if (!receipt || !/^[A-Za-z0-9_+/=-]{1,4096}$/.test(receipt)) throw new Error('Missing or invalid payment receipt; do not repay')
  const body = stdout.slice(0, match.index).trim()
  const data = JSON.parse(body) as { orderId?: string; status?: string }
  if (data.status !== 'awaiting_receipt' || typeof data.orderId !== 'string') throw new Error('Unexpected purchase response; keep the receipt and do not repay')
  return { receipt, body, orderId: data.orderId }
}
