export function reportAccessMessage(reportId: string, wallet: string, issuedAt: string): string {
  return ['Kolosseum report access v1', `report:${reportId}`, `wallet:${wallet}`, `issuedAt:${issuedAt}`].join('\n')
}
