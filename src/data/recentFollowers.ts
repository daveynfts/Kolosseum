/**
 * Curated recent-follow snapshots (who followed the KOL).
 * Key = KOL handle (case-insensitive lookup).
 */
export interface RecentFollower {
  handle: string
  displayName: string
  /** Human-readable relative time, e.g. "8 days ago" */
  followedAgo: string
  /** Optional ISO for sorting */
  followedAt?: string
}

export const RECENT_FOLLOWERS_BY_HANDLE: Record<string, RecentFollower[]> = {
  thuancapital: [
    {
      handle: 'bitcoinnews',
      displayName: 'Bitcoin.com News',
      followedAgo: '8 days ago',
      followedAt: '2026-07-02T00:00:00.000Z',
    },
    {
      handle: 'star_okx',
      displayName: 'Star_OKX',
      followedAgo: '18 days ago',
      followedAt: '2026-06-22T00:00:00.000Z',
    },
    {
      handle: 'plpiaoliang',
      displayName: 'PL 漂亮 (✱,✱)',
      followedAgo: '4 months ago',
      followedAt: '2026-03-10T00:00:00.000Z',
    },
    {
      handle: 'linkchainlink',
      displayName: 'Albie',
      followedAgo: '5 months ago',
      followedAt: '2026-02-10T00:00:00.000Z',
    },
    {
      handle: 'madcapslaugh',
      displayName: 'Jonathan Caras',
      followedAgo: '8 months ago',
      followedAt: '2025-11-10T00:00:00.000Z',
    },
    {
      handle: 'chinapumpwxc',
      displayName: '中国密码鲸公司 WHALE CHINESE',
      followedAgo: '8 months ago',
      followedAt: '2025-11-08T00:00:00.000Z',
    },
    {
      handle: 'jasonmdesimone',
      displayName: 'Jason Desimone ⚔️',
      followedAgo: '9 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'mingjunbj',
      displayName: '铭君 |mingjun.eth',
      followedAgo: '9 months ago',
      followedAt: '2025-10-08T00:00:00.000Z',
    },
    {
      handle: 'memebestbot',
      displayName: 'MemeBest',
      followedAgo: '9 months ago',
      followedAt: '2025-10-05T00:00:00.000Z',
    },
    {
      handle: 'elder24601',
      displayName: 'Ryan Kung',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
    {
      handle: 'zhoukelvinzzzz',
      displayName: 'Vincentzzh｜Techflame & ScalingX',
      followedAgo: 'a year ago',
      followedAt: '2025-07-08T00:00:00.000Z',
    },
    {
      handle: 'chandlerguo',
      displayName: 'ChandlerGuo 郭宏才 宝二爷',
      followedAgo: 'a year ago',
      followedAt: '2025-07-05T00:00:00.000Z',
    },
    {
      handle: 'cryptobravehq',
      displayName: '加密无畏',
      followedAgo: 'a year ago',
      followedAt: '2025-07-01T00:00:00.000Z',
    },
  ],
  emilyyvuong: [
    {
      handle: 'madcapslaugh',
      displayName: 'Jonathan Caras',
      followedAgo: '8 months ago',
      followedAt: '2025-11-10T00:00:00.000Z',
    },
    {
      handle: 'miaferrariii',
      displayName: 'Mia',
      followedAgo: '9 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'loi_luu',
      displayName: 'Loi Luu',
      followedAgo: '9 months ago',
      followedAt: '2025-10-08T00:00:00.000Z',
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
  ],
  thekhuongeth: [
    {
      handle: 'crypto_cat888',
      displayName: 'LazyCat|猫姐',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: 'eth_cedric',
      displayName: 'Cedric',
      followedAgo: 'a month ago',
      followedAt: '2026-06-14T00:00:00.000Z',
    },
    {
      handle: 'aa_afeng',
      displayName: '阿峰_Afeng',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'xiaonezha_lab',
      displayName: '小哪吒lab',
      followedAgo: '7 months ago',
      followedAt: '2025-12-15T00:00:00.000Z',
    },
    {
      handle: 'madcapslaugh',
      displayName: 'Jonathan Caras',
      followedAgo: '8 months ago',
      followedAt: '2025-11-10T00:00:00.000Z',
    },
    {
      handle: 'bleuonbase',
      displayName: 'agusti',
      followedAgo: '8 months ago',
      followedAt: '2025-11-08T00:00:00.000Z',
    },
    {
      handle: 'defiapp',
      displayName: 'Defi App',
      followedAgo: '8 months ago',
      followedAt: '2025-11-05T00:00:00.000Z',
    },
    {
      handle: 'huijiu68',
      displayName: '小灰韭',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: '0xfelix',
      displayName: 'FelixBNB',
      followedAgo: 'a year ago',
      followedAt: '2025-07-13T00:00:00.000Z',
    },
    {
      handle: 'chinapumpwxc',
      displayName: '中国密码鲸公司 WHALE CHINESE',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'the_wooo',
      displayName: 'memory',
      followedAgo: 'a year ago',
      followedAt: '2025-07-11T00:00:00.000Z',
    },
    {
      handle: '0xamazingchar',
      displayName: 'Chacha',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
    {
      handle: 'zhuilong888',
      displayName: 'Writer',
      followedAgo: 'a year ago',
      followedAt: '2025-07-09T00:00:00.000Z',
    },
    {
      handle: 'cryptocharming',
      displayName: 'CryptoCharming',
      followedAgo: 'a year ago',
      followedAt: '2025-07-08T00:00:00.000Z',
    },
    {
      handle: 'superl9',
      displayName: 'Wick李 BNB',
      followedAgo: 'a year ago',
      followedAt: '2025-07-07T00:00:00.000Z',
    },
    {
      handle: 'blockdao_1',
      displayName: 'blockdao',
      followedAgo: 'a year ago',
      followedAt: '2025-07-06T00:00:00.000Z',
    },
    {
      handle: 'liping007',
      displayName: '李平平无奇',
      followedAgo: 'a year ago',
      followedAt: '2025-07-05T00:00:00.000Z',
    },
  ],
}

export function getRecentFollowers(handle: string): RecentFollower[] {
  const key = handle.replace(/^@/, '').trim().toLowerCase()
  return RECENT_FOLLOWERS_BY_HANDLE[key] ?? []
}
