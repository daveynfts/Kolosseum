export function reportAccessMessage(reportId: string, wallet: string, issuedAt: string): string {
  return ['Kolosseum report access v1', `report:${reportId}`, `wallet:${wallet}`, `issuedAt:${issuedAt}`].join('\n')
}

export function dashboardAccessMessage(wallet: string, issuedAt: string): string {
  return ['Kolosseum buyer dashboard v1', `wallet:${wallet}`, `issuedAt:${issuedAt}`].join('\n')
}

export function liveAccessMessage(wallet: string, issuedAt: string): string {
  return ['Kolosseum live research session v1', `wallet:${wallet}`, `issuedAt:${issuedAt}`, 'Valid for 45 minutes: view reports, request quotes, and manage your report permissions. SOL payments and NFT changes require a separate transaction approval.'].join('\n')
}
