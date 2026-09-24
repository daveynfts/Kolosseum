export function reportAccessMessage(reportId: string, wallet: string, issuedAt: string): string {
  return ['Kolosseum report access v1', `report:${reportId}`, `wallet:${wallet}`, `issuedAt:${issuedAt}`].join('\n')
}

export function dashboardAccessMessage(wallet: string, issuedAt: string): string {
  return ['Kolosseum buyer dashboard v1', `wallet:${wallet}`, `issuedAt:${issuedAt}`].join('\n')
}
