import { describe, expect, it } from 'vitest'
import { parsePayCliOutput } from './payCliOutput'
describe('Pay CLI receipt preservation', () => {
  it('extracts the final write-out on Windows without including it in response JSON', () => {
    expect(parsePayCliOutput('{"orderId":"order","status":"awaiting_receipt"}\r\nKOLOSSEUM_RECEIPT:YWJjZA==\r\n')).toEqual({receipt:'YWJjZA==',body:'{"orderId":"order","status":"awaiting_receipt"}',orderId:'order'})
  })
  it('fails closed when output is truncated, unreceipted or not an accepted order', () => {
    for(const value of ['{}','{}\nKOLOSSEUM_RECEIPT:\n','{}\nKOLOSSEUM_RECEIPT:YWJj\n']) expect(()=>parsePayCliOutput(value)).toThrow()
  })
})
