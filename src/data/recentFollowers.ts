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
  /** Optional score / rank proxy (TwitterScore etc.) */
  score?: number
}

/** High-signal accounts that follow the KOL (SurfAI / graph quality list). */
export interface SmartFollower {
  handle: string
  displayName: string
  /** Role label, e.g. "Founder of OKX" */
  role?: string
  /** Their X follower count (if known) */
  followers?: number
  /** Influence score (SurfAI / ranking proxy) */
  influenceScore?: number
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
  tcvncommunity: [
    {
      handle: 'jasonmdesimone',
      displayName: 'Jason Desimone ⚔️',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: '0xyukirabbit',
      displayName: 'Yuki Rabbit',
      followedAgo: '2 months ago',
      followedAt: '2026-05-15T00:00:00.000Z',
    },
    {
      handle: '0x_chok',
      displayName: 'Chok加密楚克',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'zama',
      displayName: 'Zama',
      followedAgo: '7 months ago',
      followedAt: '2025-12-15T00:00:00.000Z',
    },
    {
      handle: 'junztsang',
      displayName: 'Junz Tsang',
      followedAgo: '7 months ago',
      followedAt: '2025-12-10T00:00:00.000Z',
    },
    {
      handle: 'gabrysia_eth',
      displayName: 'Gabi',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: 'blockjengirl',
      displayName: 'Jen Jen Aura Queen',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'x_may_crypto',
      displayName: 'May',
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
      handle: 'phyrexni',
      displayName: 'Phyrex',
      followedAgo: 'a year ago',
      followedAt: '2025-07-05T00:00:00.000Z',
    },
  ],
  leninugreal: [
    {
      handle: 'wilsonye2025',
      displayName: 'Wilson Ye',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth ｜买美股上币安',
      followedAgo: '4 months ago',
      followedAt: '2026-03-15T00:00:00.000Z',
    },
    {
      handle: 'leadlagreport',
      displayName: 'Michael A. Gayed, CFA',
      followedAgo: '7 months ago',
      followedAt: '2025-12-15T00:00:00.000Z',
    },
    {
      handle: 'chinapumpwxc',
      displayName: '中国密码鲸公司 WHALE CHINESE',
      followedAgo: '8 months ago',
      followedAt: '2025-11-12T00:00:00.000Z',
    },
    {
      handle: 'madcapslaugh',
      displayName: 'Jonathan Caras',
      followedAgo: '8 months ago',
      followedAt: '2025-11-10T00:00:00.000Z',
    },
    {
      handle: 'defiapp',
      displayName: 'Defi App',
      followedAgo: '8 months ago',
      followedAt: '2025-11-05T00:00:00.000Z',
    },
    {
      handle: 'sukie234',
      displayName: 'sukie',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'afangyuan',
      displayName: '方源',
      followedAgo: 'a year ago',
      followedAt: '2025-07-08T00:00:00.000Z',
    },
  ],
  lecter_xfinance: [
    {
      handle: '0xsexybanana',
      displayName: '郡主Christine (✱,✱)',
      followedAgo: '8 days ago',
      followedAt: '2026-07-07T00:00:00.000Z',
    },
    {
      handle: 'renaissxyz',
      displayName: 'Renaiss.xyz',
      followedAgo: '2 months ago',
      followedAt: '2026-05-15T00:00:00.000Z',
    },
    {
      handle: 'plus_ultra_715',
      displayName: 'Winchman@Renaiss',
      followedAgo: '2 months ago',
      followedAt: '2026-05-14T00:00:00.000Z',
    },
    {
      handle: 'mej50749',
      displayName: 'MEJ毛毛姐',
      followedAgo: '2 months ago',
      followedAt: '2026-05-12T00:00:00.000Z',
    },
    {
      handle: 'wolfyxbt',
      displayName: '杀破狼 WolfyXBT',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'cindycreation',
      displayName: 'Cindy胖迪',
      followedAgo: '5 months ago',
      followedAt: '2026-02-15T00:00:00.000Z',
    },
    {
      handle: 'iamyourchaos',
      displayName: '小捕手 Chaos',
      followedAgo: '5 months ago',
      followedAt: '2026-02-12T00:00:00.000Z',
    },
    {
      handle: 'blendino',
      displayName: 'Dino',
      followedAgo: '6 months ago',
      followedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      handle: 'miaferrariii',
      displayName: 'Mia',
      followedAgo: '9 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'randhindi',
      displayName: 'Rand',
      followedAgo: '10 months ago',
      followedAt: '2025-09-15T00:00:00.000Z',
    },
    {
      handle: 'definitivefi',
      displayName: 'DEFINITIVE',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: 'liyinjyun',
      displayName: '羊咩咩.m｜MemeMax⚡️',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'lootrealms',
      displayName: 'Realms.World ☁️',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
  ],
  lensmoso: [
    {
      handle: 'skylinee',
      displayName: 'SKYLINE',
      followedAgo: '10 days ago',
      followedAt: '2026-07-05T00:00:00.000Z',
    },
    {
      handle: '0xsexybanana',
      displayName: '郡主Christine (✱,✱)',
      followedAgo: '10 days ago',
      followedAt: '2026-07-05T00:00:00.000Z',
    },
    {
      handle: 'daoheking',
      displayName: 'LF 刀河王 ｜买美股上币安',
      followedAgo: '24 days ago',
      followedAt: '2026-06-21T00:00:00.000Z',
    },
    {
      handle: 'phill76815',
      displayName: '龙神-Dragon God',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: 'plus_ultra_715',
      displayName: 'Winchman@Renaiss',
      followedAgo: 'a month ago',
      followedAt: '2026-06-14T00:00:00.000Z',
    },
    {
      handle: 'sunnymq1',
      displayName: 'Sunny Tang | Bird',
      followedAgo: 'a month ago',
      followedAt: '2026-06-13T00:00:00.000Z',
    },
    {
      handle: 'daxianvip',
      displayName: '大仙',
      followedAgo: 'a month ago',
      followedAt: '2026-06-12T00:00:00.000Z',
    },
    {
      handle: 'feliperamm',
      displayName: 'Felipe Ramm - sulpha.eth',
      followedAgo: 'a month ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: 'candyjjjjj',
      displayName: 'Tangerine Candy MemeMax⚡️',
      followedAgo: 'a month ago',
      followedAt: '2026-06-10T00:00:00.000Z',
    },
    {
      handle: 'dajingou1',
      displayName: 'pandaWL/买美股上币安',
      followedAgo: 'a month ago',
      followedAt: '2026-06-09T00:00:00.000Z',
    },
    {
      handle: 'laowu3677',
      displayName: 'Web3老吴',
      followedAgo: 'a month ago',
      followedAt: '2026-06-08T00:00:00.000Z',
    },
    {
      handle: '0xmichael',
      displayName: 'Michael',
      followedAgo: 'a month ago',
      followedAt: '2026-06-07T00:00:00.000Z',
    },
    {
      handle: 'daxiagua1',
      displayName: '大西瓜',
      followedAgo: 'a month ago',
      followedAt: '2026-06-06T00:00:00.000Z',
    },
    {
      handle: '798_eth',
      displayName: '798.eth ☮️',
      followedAgo: 'a month ago',
      followedAt: '2026-06-05T00:00:00.000Z',
    },
    {
      handle: 'oceansbaby_',
      displayName: 'Cruise橘子哥',
      followedAgo: '2 months ago',
      followedAt: '2026-05-15T00:00:00.000Z',
    },
    {
      handle: 'arixzone',
      displayName: '魔都老猿',
      followedAgo: '2 months ago',
      followedAt: '2026-05-14T00:00:00.000Z',
    },
    {
      handle: 'byzianna_',
      displayName: 'Zianna',
      followedAgo: '2 months ago',
      followedAt: '2026-05-13T00:00:00.000Z',
    },
    {
      handle: 'wilsonye2025',
      displayName: 'Wilson Ye',
      followedAgo: '2 months ago',
      followedAt: '2026-05-12T00:00:00.000Z',
    },
    {
      handle: 'tuituiweb3',
      displayName: 'TUTU.图图',
      followedAgo: '2 months ago',
      followedAt: '2026-05-11T00:00:00.000Z',
    },
    {
      handle: 'hunter_nft',
      displayName: 'hunter berg',
      followedAgo: '2 months ago',
      followedAt: '2026-05-10T00:00:00.000Z',
    },
    {
      handle: 'kennethbosak',
      displayName: 'Kenn Bosak',
      followedAgo: '2 months ago',
      followedAt: '2026-05-09T00:00:00.000Z',
    },
    {
      handle: 'renaissxyz',
      displayName: 'Renaiss.xyz',
      followedAgo: '2 months ago',
      followedAt: '2026-05-08T00:00:00.000Z',
    },
    {
      handle: 'lucky1seth',
      displayName: 'Lucky1s✝️',
      followedAgo: '2 months ago',
      followedAt: '2026-05-07T00:00:00.000Z',
    },
    {
      handle: 'thepilot_x',
      displayName: 'ThePilot.x',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'flowtradertm',
      displayName: 'Flow',
      followedAgo: '3 months ago',
      followedAt: '2026-04-14T00:00:00.000Z',
    },
    {
      handle: 'science_qs',
      displayName: 'iRiSh',
      followedAgo: '3 months ago',
      followedAt: '2026-04-13T00:00:00.000Z',
    },
    {
      handle: 'mbxxvv',
      displayName: 'MB.hl',
      followedAgo: '3 months ago',
      followedAt: '2026-04-12T00:00:00.000Z',
    },
    {
      handle: 'laurentcastell',
      displayName: 'Laurent Castellani',
      followedAgo: '3 months ago',
      followedAt: '2026-04-11T00:00:00.000Z',
    },
    {
      handle: 'the_beacon_gg',
      displayName: 'The Beacon',
      followedAgo: '3 months ago',
      followedAt: '2026-04-10T00:00:00.000Z',
    },
  ],
  mingli0x: [
    {
      handle: 'chenchen4410999',
      displayName: '藍色彈塗魚',
      followedAgo: '9 hours ago',
      followedAt: '2026-07-14T22:00:00.000Z',
    },
    {
      handle: 'tangjinzhou',
      displayName: 'tangjinzhou',
      followedAgo: 'a day ago',
      followedAt: '2026-07-14T00:00:00.000Z',
    },
    {
      handle: 'cynbahati',
      displayName: 'Cynthia',
      followedAgo: '21 days ago',
      followedAt: '2026-06-24T00:00:00.000Z',
    },
    {
      handle: 'mrlarus',
      displayName: 'Larus Canus',
      followedAgo: '22 days ago',
      followedAt: '2026-06-23T00:00:00.000Z',
    },
    {
      handle: 'jimmy_jinglv',
      displayName: '吕立青_JimmyLv 226',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: 'xiaofeilong99',
      displayName: '币天天',
      followedAgo: 'a month ago',
      followedAt: '2026-06-14T00:00:00.000Z',
    },
    {
      handle: 'bitgrateful',
      displayName: 'Lawyered',
      followedAgo: '5 months ago',
      followedAt: '2026-02-15T00:00:00.000Z',
    },
    {
      handle: '466anan',
      displayName: 'Crypto Nan',
      followedAgo: 'a year ago',
      followedAt: '2025-07-15T00:00:00.000Z',
    },
    {
      handle: 'flyiiawei',
      displayName: 'flyawei｜狗宝真帅 | 预测世界杯就在Gate',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: '0xborder',
      displayName: '加密边境',
      followedAgo: 'a year ago',
      followedAt: '2025-07-13T00:00:00.000Z',
    },
    {
      handle: 'chaozuoye',
      displayName: '作业借你抄 （吃瓜版）',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'flcjbtc',
      displayName: '飞龙财经',
      followedAgo: 'a year ago',
      followedAt: '2025-07-11T00:00:00.000Z',
    },
    {
      handle: 'charles48011843',
      displayName: 'Charles ｜$ETH',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
    {
      handle: 'daxianvip',
      displayName: '大仙',
      followedAgo: 'a year ago',
      followedAt: '2025-07-09T00:00:00.000Z',
    },
    {
      handle: 'wjf110',
      displayName: '好家伙',
      followedAgo: 'a year ago',
      followedAt: '2025-07-08T00:00:00.000Z',
    },
    {
      handle: 'joensmoon',
      displayName: '乔帮主退休月球收租',
      followedAgo: 'a year ago',
      followedAt: '2025-07-07T00:00:00.000Z',
    },
    {
      handle: 'zkgoudan',
      displayName: '李狗蛋3.0',
      followedAgo: 'a year ago',
      followedAt: '2025-07-06T00:00:00.000Z',
    },
    {
      handle: 'gala_nft2',
      displayName: 'gala⚡',
      followedAgo: 'a year ago',
      followedAt: '2025-07-05T00:00:00.000Z',
    },
    {
      handle: 'wajueji888',
      displayName: '挖掘机｜买美股上币安',
      followedAgo: 'a year ago',
      followedAt: '2025-07-04T00:00:00.000Z',
    },
    {
      handle: 'gn_zebraleyuan',
      displayName: '迪尔Dir.',
      followedAgo: 'a year ago',
      followedAt: '2025-07-03T00:00:00.000Z',
    },
    {
      handle: 'zijing',
      displayName: '子敬',
      followedAgo: 'a year ago',
      followedAt: '2025-07-02T00:00:00.000Z',
    },
    {
      handle: 'web3zy8',
      displayName: '左右BNB',
      followedAgo: 'a year ago',
      followedAt: '2025-07-01T00:00:00.000Z',
    },
    {
      handle: 'hashnewshk',
      displayName: '哈世链闻',
      followedAgo: 'a year ago',
      followedAt: '2025-06-30T00:00:00.000Z',
    },
    {
      handle: 'feifan7686',
      displayName: '飞凡',
      followedAgo: 'a year ago',
      followedAt: '2025-06-29T00:00:00.000Z',
    },
    {
      handle: 'hm010169',
      displayName: '币圈荒木｜Araki',
      followedAgo: 'a year ago',
      followedAt: '2025-06-28T00:00:00.000Z',
    },
    {
      handle: 'jiujinshan2022',
      displayName: '旧金山不是巴黎(Meme部部长）',
      followedAgo: 'a year ago',
      followedAt: '2025-06-27T00:00:00.000Z',
    },
    {
      handle: 'daoheking',
      displayName: 'LF 刀河王 ｜买美股上币安',
      followedAgo: 'a year ago',
      followedAt: '2025-06-26T00:00:00.000Z',
    },
  ],
  /** Trí Mai (@TriMaiMS) — curated smart/recent followers snapshot */
  trimaims: [
    {
      handle: 'wilsonye2025',
      displayName: 'Wilson Ye',
      followedAgo: 'a month ago',
      followedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      handle: 'nftunit01',
      displayName: 'NFT特攻队(,)',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'allodev',
      displayName: 'Allo',
      followedAgo: '7 months ago',
      followedAt: '2025-12-15T00:00:00.000Z',
    },
    {
      handle: 'miaferrariii',
      displayName: 'Mia',
      followedAgo: '8 months ago',
      followedAt: '2025-11-15T00:00:00.000Z',
    },
    {
      handle: 'kybernetwork',
      displayName: 'Kyber Network',
      followedAgo: '9 months ago',
      followedAt: '2025-10-15T00:00:00.000Z',
    },
    {
      handle: 'gcsbtc',
      displayName: 'Crypto攻城狮',
      followedAgo: '9 months ago',
      followedAt: '2025-10-12T00:00:00.000Z',
    },
    {
      handle: 'bitgrateful',
      displayName: 'Lawyered',
      followedAgo: '9 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'syk233',
      displayName: 'syk233 MemeMax ⚡️|TermMax',
      followedAgo: '10 months ago',
      followedAt: '2025-09-15T00:00:00.000Z',
    },
    {
      handle: 'liaoblove520',
      displayName: '龙猫·liaoblove',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: 'definitivefi',
      displayName: 'DEFINITIVE',
      followedAgo: 'a year ago',
      followedAt: '2025-07-13T00:00:00.000Z',
    },
    {
      handle: 'wallstreet_wsc',
      displayName: '华尔街之狼',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'btcdefidadi',
      displayName: 'Vincent',
      followedAgo: 'a year ago',
      followedAt: '2025-07-11T00:00:00.000Z',
    },
    {
      handle: 'gala_nft2',
      displayName: 'gala⚡',
      followedAgo: 'a year ago',
      followedAt: '2025-07-10T00:00:00.000Z',
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-07-09T00:00:00.000Z',
    },
    {
      handle: 'hashnewshk',
      displayName: '哈世链闻',
      followedAgo: 'a year ago',
      followedAt: '2025-07-08T00:00:00.000Z',
    },
  ],
  /** Trấn Thành (@tranthanhbk) — curated smart/recent followers snapshot */
  tranthanhbk: [
    {
      handle: '0xsexybanana',
      displayName: '郡主Christine (✱,✱)',
      followedAgo: '11 days ago',
      followedAt: '2026-07-04T00:00:00.000Z',
    },
    {
      handle: 'tortugo',
      displayName: 'Tortugo.HL',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth ｜买美股上币安',
      followedAgo: '4 months ago',
      followedAt: '2026-03-15T00:00:00.000Z',
    },
    {
      handle: 'codyboston19',
      displayName: 'Cheetahgang.ETH',
      followedAgo: '5 months ago',
      followedAt: '2026-02-15T00:00:00.000Z',
    },
    {
      handle: '0xdamien',
      displayName: 'Damien (dm for Cracked Devs)',
      followedAgo: '6 months ago',
      followedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      handle: 'onesource_io',
      displayName: 'OneSource',
      followedAgo: '10 months ago',
      followedAt: '2025-09-15T00:00:00.000Z',
    },
  ],
  /** Thành Phan (@bachkhoabnb) — curated smart/recent followers snapshot */
  bachkhoabnb: [
    {
      handle: 'plus_ultra_715',
      displayName: 'Winchman@Renaiss',
      followedAgo: '2 months ago',
      followedAt: '2026-05-15T00:00:00.000Z',
    },
    {
      handle: 'renaissxyz',
      displayName: 'Renaiss.xyz',
      followedAgo: '2 months ago',
      followedAt: '2026-05-14T00:00:00.000Z',
    },
    {
      handle: 'btc_789',
      displayName: '0xKeyNG',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'jasonmdesimone',
      displayName: 'Jason Desimone ⚔️',
      followedAgo: '5 months ago',
      followedAt: '2026-02-15T00:00:00.000Z',
    },
    {
      handle: 'randhindi',
      displayName: 'Rand',
      followedAgo: '10 months ago',
      followedAt: '2025-09-15T00:00:00.000Z',
    },
  ],
  /** Ape (@immrape) — curated smart/recent followers snapshot */
  immrape: [
    {
      handle: 'tiezhucrypto',
      displayName: '铁柱',
      followedAgo: '21 days ago',
      followedAt: '2026-06-26T00:00:00.000Z',
    },
    {
      handle: 'nftcps',
      displayName: '鸟哥 | 蓝鸟会️',
      followedAgo: '2 months ago',
      followedAt: '2026-05-17T00:00:00.000Z',
    },
    {
      handle: 'coldwhite18',
      displayName: 'zack | 扎克',
      followedAgo: '6 months ago',
      followedAt: '2026-01-17T00:00:00.000Z',
    },
    {
      handle: 'ki_smoon12',
      displayName: 'Ki.',
      followedAgo: '10 months ago',
      followedAt: '2025-09-17T00:00:00.000Z',
    },
    {
      handle: 'longtian168',
      displayName: '八發金豆',
      followedAgo: '10 months ago',
      followedAt: '2025-09-16T00:00:00.000Z',
    },
    {
      handle: 'xiaofeilong99',
      displayName: '币天天',
      followedAgo: '10 months ago',
      followedAt: '2025-09-15T00:00:00.000Z',
    },
    {
      handle: 'fityeth',
      displayName: 'fity.eth',
      followedAgo: '10 months ago',
      followedAt: '2025-09-14T00:00:00.000Z',
    },
    {
      handle: 'cryptoukong',
      displayName: 'UKong | Bird️',
      followedAgo: '10 months ago',
      followedAt: '2025-09-13T00:00:00.000Z',
    },
    {
      handle: 'daoheking',
      displayName: 'LF 刀河王 ｜买美股上币安',
      followedAgo: '10 months ago',
      followedAt: '2025-09-12T00:00:00.000Z',
    },
    {
      handle: 'btc100000015252',
      displayName: '加密贝姐LK',
      followedAgo: '10 months ago',
      followedAt: '2025-09-11T00:00:00.000Z',
    },
    {
      handle: 'theog_general',
      displayName: 'OG General',
      followedAgo: 'a year ago',
      followedAt: '2025-07-17T00:00:00.000Z',
    },
    {
      handle: 'thesoftestrock1',
      displayName: 'Thesoftestrock',
      followedAgo: 'a year ago',
      followedAt: '2025-07-16T00:00:00.000Z',
    },
  ],
  /** Martin (@Martin_bml) — curated smart/recent followers snapshot */
  martin_bml: [
    {
      handle: 'wilsonye2025',
      displayName: 'Wilson Ye',
      followedAgo: '1 month ago',
      followedAt: '2026-06-17T00:00:00.000Z',
    },
    {
      handle: 'jiujinshan2022',
      displayName: '旧金山不是巴黎(Meme部部长）',
      followedAgo: '2 months ago',
      followedAt: '2026-05-17T00:00:00.000Z',
    },
    {
      handle: 'andrea__chang',
      displayName: 'Andrea',
      followedAgo: '4 months ago',
      followedAt: '2026-03-17T00:00:00.000Z',
    },
    {
      handle: 'wenser2010',
      displayName: 'Wenser（.）',
      followedAgo: '10 months ago',
      followedAt: '2025-09-17T00:00:00.000Z',
    },
    {
      handle: 'hongchen1476842',
      displayName: '彭鱼宴',
      followedAgo: 'a year ago',
      followedAt: '2025-07-17T00:00:00.000Z',
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-07-16T00:00:00.000Z',
    },
  ],
  /** Jack Vĩ (@jackvi810) — curated smart/recent followers snapshot */
  jackvi810: [
    {
      handle: 'emilylazar_sm',
      displayName: 'Emily Lazar',
      followedAgo: '6 months ago',
      followedAt: '2026-01-17T00:00:00.000Z',
    },
    {
      handle: 'tortugo',
      displayName: 'Tortugo.HL',
      followedAgo: '7 months ago',
      followedAt: '2025-12-17T00:00:00.000Z',
    },
    {
      handle: 'rileybeans_',
      displayName: 'rileybeans',
      followedAgo: '9 months ago',
      followedAt: '2025-10-17T00:00:00.000Z',
    },
    {
      handle: 'daxianvip',
      displayName: '大仙',
      followedAgo: '9 months ago',
      followedAt: '2025-10-16T00:00:00.000Z',
    },
    {
      handle: 'shivst3r',
      displayName: 'Shiv',
      followedAgo: 'a year ago',
      followedAt: '2025-07-17T00:00:00.000Z',
    },
    {
      handle: 'rav_hedda',
      displayName: 'Hedda',
      followedAgo: 'a year ago',
      followedAt: '2025-07-16T00:00:00.000Z',
    },
    {
      handle: 'playmatejaylene',
      displayName: 'Jaylene',
      followedAgo: 'a year ago',
      followedAt: '2025-07-15T00:00:00.000Z',
    },
    {
      handle: 'riconomi',
      displayName: 'Rico里里',
      followedAgo: 'a year ago',
      followedAt: '2025-07-14T00:00:00.000Z',
    },
    {
      handle: 'hongchen1476842',
      displayName: '彭鱼宴',
      followedAgo: 'a year ago',
      followedAt: '2025-07-13T00:00:00.000Z',
    },
    {
      handle: 'zhoukelvinzzzz',
      displayName: 'Vincentzzh｜Techflame & ScalingX',
      followedAgo: 'a year ago',
      followedAt: '2025-07-12T00:00:00.000Z',
    },
    {
      handle: 'junshao_666',
      displayName: 'Crypto_君少',
      followedAgo: 'a year ago',
      followedAt: '2025-07-11T00:00:00.000Z',
    },
  ],
  /** Đông Phạm (@phamduydong179) — curated smart/recent followers snapshot */
  phamduydong179: [
    {
      handle: 'evans666666',
      displayName: 'Evans.eth  ｜买美股上币安',
      followedAgo: '4 months ago',
      followedAt: '2026-03-17T00:00:00.000Z',
    },
    {
      handle: 'madcapslaugh',
      displayName: 'Jonathan Caras',
      followedAgo: '8 months ago',
      followedAt: '2025-11-17T00:00:00.000Z',
    },
    {
      handle: 'btc_strategy',
      displayName: '策略掌门人 BNB',
      followedAgo: '9 months ago',
      followedAt: '2025-10-17T00:00:00.000Z',
    },
    {
      handle: 'chandlerguo',
      displayName: 'ChandlerGuo 郭宏才 宝二爷',
      followedAgo: 'a year ago',
      followedAt: '2025-07-17T00:00:00.000Z',
    },
  ],
  /** Bi Cần Thơ (@BiCanTho) — curated smart/recent followers snapshot */
  bicantho: [
    {
      handle: 'cryptobella88',
      displayName: 'Crypto 美美',
      followedAgo: '8 months ago',
      followedAt: '2025-11-16T00:00:00.000Z',
    },
    {
      handle: 'ki_young_ju',
      displayName: 'Ki Young Ju',
      followedAgo: '9 months ago',
      followedAt: '2025-10-16T00:00:00.000Z',
    },
    {
      handle: '0xmoon',
      displayName: '0xMoon',
      followedAgo: 'a year ago',
      followedAt: '2025-07-16T00:00:00.000Z',
    },
  ],
  /** Phạm Ninh (@NickyPham_HC) — curated smart/recent followers snapshot */
  nickypham_hc: [
    {
      handle: 'nftunit01',
      displayName: 'NFT特攻队(,)',
      followedAgo: '3 months ago',
      followedAt: '2026-04-16T00:00:00.000Z',
    },
    {
      handle: '0x_chok',
      displayName: 'Chok加密楚克',
      followedAgo: '3 months ago',
      followedAt: '2026-04-15T00:00:00.000Z',
    },
    {
      handle: 'btc99m',
      displayName: 'Dylan.迪伦丨RIVERTermMax',
      followedAgo: '3 months ago',
      followedAt: '2026-04-14T00:00:00.000Z',
    },
    {
      handle: 'betashop',
      displayName: 'Jason Goldberg',
      followedAgo: '5 months ago',
      followedAt: '2026-02-16T00:00:00.000Z',
    },
    {
      handle: 'star_okx',
      displayName: 'Star_OKX',
      followedAgo: '6 months ago',
      followedAt: '2026-01-16T00:00:00.000Z',
    },
    {
      handle: 'cryptobella88',
      displayName: 'Crypto 美美',
      followedAgo: '8 months ago',
      followedAt: '2025-11-16T00:00:00.000Z',
    },
    {
      handle: 'aaronteng',
      displayName: 'Aaron Teng 安伦',
      followedAgo: '8 months ago',
      followedAt: '2025-11-15T00:00:00.000Z',
    },
    {
      handle: 'vvxiaoyu8888',
      displayName: '小鱼DaisyBNB',
      followedAgo: '8 months ago',
      followedAt: '2025-11-14T00:00:00.000Z',
    },
    {
      handle: 'syk233',
      displayName: 'syk233 MemeMax ⚡️|TermMax',
      followedAgo: '9 months ago',
      followedAt: '2025-10-16T00:00:00.000Z',
    },
    {
      handle: 'afangyuan',
      displayName: '方源',
      followedAgo: 'a year ago',
      followedAt: '2025-07-16T00:00:00.000Z',
    },
    {
      handle: 'chandlerguo',
      displayName: 'ChandlerGuo 郭宏才 宝二爷',
      followedAgo: 'a year ago',
      followedAt: '2025-07-15T00:00:00.000Z',
    },
  ],

  /**
   * Hak Research (@HakResearch) — curated recent followers snapshot.
   * score = điểm / thứ hạng TwitterScore (nếu có).
   */
  hakresearch: [
    {
      handle: '0xsweep',
      displayName: 'Sweep',
      followedAgo: '25 days ago',
      followedAt: '2026-07-02T00:00:00.000Z',
      score: 1430,
    },
    {
      handle: 'greta0086',
      displayName: 'Greta008',
      followedAgo: '6 months ago',
      followedAt: '2026-01-27T00:00:00.000Z',
      score: 3395,
    },
    {
      handle: 'marcinredstone',
      displayName: 'Marcin Kazmierczak ♦️',
      followedAgo: '9 months ago',
      followedAt: '2025-10-27T00:00:00.000Z',
      score: 9331,
    },
    {
      handle: 'boredelonmusk',
      displayName: 'BORED',
      followedAgo: '10 months ago',
      followedAt: '2025-09-27T00:00:00.000Z',
      score: 140,
    },
    {
      handle: 'jtsong2',
      displayName: 'Jtsong.eth (Ø,G)',
      followedAgo: '1 year ago',
      followedAt: '2025-07-27T00:00:00.000Z',
      score: 4180,
    },
    {
      handle: 'jeffmindfulness',
      displayName: 'Jeff | Mindfulness',
      followedAgo: '1 year ago',
      followedAt: '2025-07-26T00:00:00.000Z',
      score: 19108,
    },
    {
      handle: 'defiignas',
      displayName: 'Ignas | DeFi',
      followedAgo: '1 year ago',
      followedAt: '2025-07-25T00:00:00.000Z',
      score: 390,
    },
    {
      handle: 'serpinxbt',
      displayName: 'Serpin Taxt',
      followedAgo: '1 year ago',
      followedAt: '2025-07-24T00:00:00.000Z',
      score: 12697,
    },
    {
      handle: 'kkmoat',
      displayName: 'kkmoat.btc',
      followedAgo: '1 year ago',
      followedAt: '2025-07-23T00:00:00.000Z',
      score: 761,
    },
  ],

  /**
   * Thiên Thiên (@Thienthien1305) — curated recent followers snapshot.
   * score = điểm / thứ hạng TwitterScore (🏆).
   */
  thienthien1305: [
    {
      handle: 'martindale',
      displayName: 'Eric Martindale [₿]',
      followedAgo: '4 months ago',
      followedAt: '2026-03-27T00:00:00.000Z',
      score: 17112,
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth🇨🇳 🇻🇳🇮🇩',
      followedAgo: '4 months ago',
      followedAt: '2026-03-26T00:00:00.000Z',
      score: 6837,
    },
    {
      handle: 'mrryanchi',
      displayName: 'Mr.RC｜𝟎𝐱𝐔',
      followedAgo: '10 months ago',
      followedAt: '2025-09-27T00:00:00.000Z',
      score: 6408,
    },
    {
      handle: 'lc_hk0x',
      displayName: 'LC🎮',
      followedAgo: '10 months ago',
      followedAt: '2025-09-26T00:00:00.000Z',
      score: 28298,
    },
    {
      handle: 'blockchainrese6',
      displayName: '陌陌',
      followedAgo: '1 year ago',
      followedAt: '2025-07-27T00:00:00.000Z',
      score: 7430,
    },
    {
      handle: 'afangyuan',
      displayName: '方源',
      followedAgo: '1 year ago',
      followedAt: '2025-07-26T00:00:00.000Z',
      score: 18401,
    },
    {
      handle: 'gala_nft1',
      displayName: 'gala⚡',
      followedAgo: '1 year ago',
      followedAt: '2025-07-25T00:00:00.000Z',
      score: 21830,
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: '1 year ago',
      followedAt: '2025-07-24T00:00:00.000Z',
      score: 5626,
    },
    {
      handle: 'metaio102',
      displayName: 'Meta',
      followedAgo: '1 year ago',
      followedAt: '2025-07-23T00:00:00.000Z',
      score: 4039,
    },
    {
      handle: 'nero8888',
      displayName: '🌱Nero',
      followedAgo: '1 year ago',
      followedAt: '2025-07-22T00:00:00.000Z',
      score: 6167,
    },
    {
      handle: 'hm010169',
      displayName: '币圈荒木｜Araki🪵',
      followedAgo: '1 year ago',
      followedAt: '2025-07-21T00:00:00.000Z',
      score: 2810,
    },
    {
      handle: 'gala_nft2',
      displayName: 'gala⚡',
      followedAgo: '1 year ago',
      followedAt: '2025-07-20T00:00:00.000Z',
      score: 6880,
    },
    {
      handle: '466anan',
      displayName: 'Crypto Nan',
      followedAgo: '1 year ago',
      followedAt: '2025-07-19T00:00:00.000Z',
      score: 9077,
    },
  ],
  /**
   * GF Capital (@GF_Capital) — recent follows (X snapshot 2026-08-11).
   * 泰德.eth · @ted55668 · 3 months ago
   * Evans.eth · @evans666666 · 8 months ago
   */
  gf_capital: [
    {
      handle: 'ted55668',
      displayName: '泰德.eth｜黄金汇指尽在Gate CFD',
      followedAgo: '3 months ago',
      followedAt: '2026-05-11T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
  ],
  /**
   * ShengMo.eth (@ShengMo0x) — recent follows (X snapshot 2026-08-11).
   * Allo · @allodev · 16 hours ago
   * Lawyered · @bitgrateful · 8 months ago
   * Irene Zhao · @irenezhao_ · a year ago
   */
  shengmo0x: [
    {
      handle: 'allodev',
      displayName: 'Allo',
      followedAgo: '16 hours ago',
      followedAt: '2026-08-10T17:00:00.000Z',
    },
    {
      handle: 'bitgrateful',
      displayName: 'Lawyered',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
    {
      handle: 'irenezhao_',
      displayName: 'Irene Zhao',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
  ],
  /**
   * Richard Dang (@RichardDang) — recent follows (X snapshot 2026-08-11).
   */
  richarddang: [
    {
      handle: '0x2222_',
      displayName: '鸽子',
      followedAgo: '16 days ago',
      followedAt: '2026-07-26T00:00:00.000Z',
    },
    {
      handle: 'chouchou_tx',
      displayName: '丑丑TX',
      followedAgo: 'a month ago',
      followedAt: '2026-07-11T00:00:00.000Z',
    },
    {
      handle: 'ventureweb3',
      displayName: 'ar://web3vc',
      followedAgo: 'a month ago',
      followedAt: '2026-07-10T00:00:00.000Z',
    },
    {
      handle: 'jasonmdesimone',
      displayName: 'Jason Desimone ⚔️',
      followedAgo: 'a month ago',
      followedAt: '2026-07-09T00:00:00.000Z',
    },
    {
      handle: 'xingzhanai',
      displayName: 'XZ 星展',
      followedAgo: 'a month ago',
      followedAt: '2026-07-08T00:00:00.000Z',
    },
    {
      handle: 'sjl166',
      displayName: '斯嘉丽 Scar',
      followedAgo: '2 months ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: 'nicjiang7',
      displayName: 'Nic',
      followedAgo: '2 months ago',
      followedAt: '2026-06-10T00:00:00.000Z',
    },
    {
      handle: '0xethanh',
      displayName: 'EH',
      followedAgo: '2 months ago',
      followedAt: '2026-06-09T00:00:00.000Z',
    },
    {
      handle: 'web3xwg',
      displayName: '小伍哥 | Gate 美股0费率',
      followedAgo: '2 months ago',
      followedAt: '2026-06-08T00:00:00.000Z',
    },
    {
      handle: 'phill76815',
      displayName: '龙神-Dragon God',
      followedAgo: '2 months ago',
      followedAt: '2026-06-07T00:00:00.000Z',
    },
    {
      handle: 'jimmyshequ',
      displayName: "JIM'S FRIENDS 买美股上币安",
      followedAgo: '2 months ago',
      followedAt: '2026-06-06T00:00:00.000Z',
    },
    {
      handle: 'chanceyawn',
      displayName: '阳成AI',
      followedAgo: '2 months ago',
      followedAt: '2026-06-05T00:00:00.000Z',
    },
    {
      handle: 'oknextlin',
      displayName: '大栗子',
      followedAgo: '2 months ago',
      followedAt: '2026-06-04T00:00:00.000Z',
    },
    {
      handle: 'tuge8888',
      displayName: '寻一方净土',
      followedAgo: '2 months ago',
      followedAt: '2026-06-03T00:00:00.000Z',
    },
    {
      handle: 'flcjbtc',
      displayName: '飞龙财经',
      followedAgo: '2 months ago',
      followedAt: '2026-06-02T00:00:00.000Z',
    },
    {
      handle: 'wilsonye2025',
      displayName: 'Wilson Ye',
      followedAgo: '2 months ago',
      followedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      handle: 'chenchen4410999',
      displayName: '藍色彈塗魚',
      followedAgo: '2 months ago',
      followedAt: '2026-05-31T00:00:00.000Z',
    },
    {
      handle: 'btcbears',
      displayName: '旺牛牛仔',
      followedAgo: '2 months ago',
      followedAt: '2026-05-30T00:00:00.000Z',
    },
    {
      handle: 'hunter_nft',
      displayName: 'hunter berg',
      followedAgo: '2 months ago',
      followedAt: '2026-05-29T00:00:00.000Z',
    },
    {
      handle: 'nftunit01',
      displayName: 'NFT特攻队(,)',
      followedAgo: '4 months ago',
      followedAt: '2026-04-11T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth',
      followedAgo: '4 months ago',
      followedAt: '2026-04-10T00:00:00.000Z',
    },
    {
      handle: 'garyvgroup',
      displayName: 'GaryCoinAnk',
      followedAgo: '6 months ago',
      followedAt: '2026-02-11T00:00:00.000Z',
    },
    {
      handle: 'bitgrateful',
      displayName: 'Lawyered',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
    {
      handle: 'miaferrariii',
      displayName: 'Mia',
      followedAgo: '10 months ago',
      followedAt: '2025-10-11T00:00:00.000Z',
    },
    {
      handle: 'randhindi',
      displayName: 'Rand',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
    {
      handle: 'afangyuan',
      displayName: '方源',
      followedAgo: 'a year ago',
      followedAt: '2025-08-10T00:00:00.000Z',
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-08-09T00:00:00.000Z',
    },
    {
      handle: 'liaoblove520',
      displayName: '龙猫·liaoblove',
      followedAgo: 'a year ago',
      followedAt: '2025-08-08T00:00:00.000Z',
    },
    {
      handle: 'ripeth',
      displayName: 'rip.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-08-07T00:00:00.000Z',
    },
    {
      handle: 'btcdefidadi',
      displayName: 'Vincent',
      followedAgo: 'a year ago',
      followedAt: '2025-08-06T00:00:00.000Z',
    },
  ],
  /**
   * Lisa Florentina (@LisaFlorentina8) — recent follows (X snapshot 2026-08-11).
   */
  lisaflorentina8: [
    {
      handle: 'mightydylank',
      displayName: 'Dylan K',
      followedAgo: '15 days ago',
      followedAt: '2026-07-27T00:00:00.000Z',
    },
    {
      handle: '0xmichael',
      displayName: 'Michael',
      followedAgo: '2 months ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: '0x1jf',
      displayName: '0x江峰.',
      followedAgo: '3 months ago',
      followedAt: '2026-05-11T00:00:00.000Z',
    },
    {
      handle: '0xaurskyo',
      displayName: '橘子 ∑:∞',
      followedAgo: '5 months ago',
      followedAt: '2026-03-11T00:00:00.000Z',
    },
    {
      handle: '0xg_e_d',
      displayName: 'G·E·D  BNB',
      followedAgo: '5 months ago',
      followedAt: '2026-03-10T00:00:00.000Z',
    },
    {
      handle: 'exianshengde',
      displayName: 'E先生',
      followedAgo: '5 months ago',
      followedAt: '2026-03-09T00:00:00.000Z',
    },
    {
      handle: 'cartist00',
      displayName: 'CARTIST',
      followedAgo: '7 months ago',
      followedAt: '2026-01-11T00:00:00.000Z',
    },
    {
      handle: 'chouchou_tx',
      displayName: '丑丑TX',
      followedAgo: '7 months ago',
      followedAt: '2026-01-10T00:00:00.000Z',
    },
    {
      handle: '0xyi666',
      displayName: '0xYi暖阳',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
    {
      handle: 'qingqingge152',
      displayName: '晴格格',
      followedAgo: '9 months ago',
      followedAt: '2025-11-11T00:00:00.000Z',
    },
    {
      handle: 'yjy616',
      displayName: '顾予',
      followedAgo: '9 months ago',
      followedAt: '2025-11-10T00:00:00.000Z',
    },
    {
      handle: 'butongren6',
      displayName: 'BuTongRen',
      followedAgo: '9 months ago',
      followedAt: '2025-11-09T00:00:00.000Z',
    },
    {
      handle: 'flyiiawei',
      displayName: 'flyawei',
      followedAgo: '9 months ago',
      followedAt: '2025-11-08T00:00:00.000Z',
    },
    {
      handle: 'realxiodos',
      displayName: '真诚小道士丨火币TradFi负费率',
      followedAgo: '9 months ago',
      followedAt: '2025-11-07T00:00:00.000Z',
    },
    {
      handle: 'btcdta',
      displayName: 'DTA',
      followedAgo: '9 months ago',
      followedAt: '2025-11-06T00:00:00.000Z',
    },
    {
      handle: 'zizhong999',
      displayName: '子重 BNB',
      followedAgo: '9 months ago',
      followedAt: '2025-11-05T00:00:00.000Z',
    },
    {
      handle: 'feifan7686',
      displayName: '飞凡',
      followedAgo: '9 months ago',
      followedAt: '2025-11-04T00:00:00.000Z',
    },
    {
      handle: 'the_wooo',
      displayName: 'memory',
      followedAgo: '9 months ago',
      followedAt: '2025-11-03T00:00:00.000Z',
    },
    {
      handle: 'daxianvip',
      displayName: '大仙 |Gate美股0费率',
      followedAgo: '10 months ago',
      followedAt: '2025-10-11T00:00:00.000Z',
    },
    {
      handle: 'kongbtc',
      displayName: 'Kong Trading',
      followedAgo: '10 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'mccain889',
      displayName: 'Andrew',
      followedAgo: '10 months ago',
      followedAt: '2025-10-09T00:00:00.000Z',
    },
    {
      handle: 'gn_zebraleyuan',
      displayName: '迪尔Dir.',
      followedAgo: '10 months ago',
      followedAt: '2025-10-08T00:00:00.000Z',
    },
    {
      handle: '0xzhaozhao',
      displayName: '0xzhaozhao',
      followedAgo: '10 months ago',
      followedAt: '2025-10-07T00:00:00.000Z',
    },
    {
      handle: 'cheesybun0211',
      displayName: '小汉堡  BNB',
      followedAgo: '10 months ago',
      followedAt: '2025-10-06T00:00:00.000Z',
    },
    {
      handle: '0xbclub',
      displayName: '摸金校尉 | 0xbclub',
      followedAgo: '10 months ago',
      followedAt: '2025-10-05T00:00:00.000Z',
    },
    {
      handle: 'eli5defi',
      displayName: 'Eli5DeFi',
      followedAgo: '10 months ago',
      followedAt: '2025-10-04T00:00:00.000Z',
    },
    {
      handle: 'aixuexi_ai',
      displayName: 'Engineer_AI',
      followedAgo: '10 months ago',
      followedAt: '2025-10-03T00:00:00.000Z',
    },
    {
      handle: 'fairyclub777',
      displayName: 'Fairy Club',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
  ],
  /**
   * Martin Ho (@MartinHo99999) — recent follows (X snapshot 2026-08-11).
   */
  martinho99999: [
    {
      handle: 'yatmuseum',
      displayName: '✨  ✨',
      followedAgo: '3 days ago',
      followedAt: '2026-08-08T00:00:00.000Z',
    },
    {
      handle: 'fugui8',
      displayName: '香港王富贵',
      followedAgo: '4 days ago',
      followedAt: '2026-08-07T00:00:00.000Z',
    },
    {
      handle: 'cryptobaofu',
      displayName: '暴富锦李',
      followedAgo: '5 days ago',
      followedAt: '2026-08-06T00:00:00.000Z',
    },
    {
      handle: 'yaoyaogm',
      displayName: 'YeFan 叶凡 | 柳神在哪？',
      followedAgo: '6 days ago',
      followedAt: '2026-08-05T00:00:00.000Z',
    },
    {
      handle: 'robertl83909710',
      displayName: 'Dr Robertlee 李波',
      followedAgo: '6 days ago',
      followedAt: '2026-08-05T12:00:00.000Z',
    },
    {
      handle: 'chouchou_tx',
      displayName: '丑丑TX',
      followedAgo: '6 days ago',
      followedAt: '2026-08-05T06:00:00.000Z',
    },
    {
      handle: 'xiaofei_btc',
      displayName: '小飛',
      followedAgo: '6 days ago',
      followedAt: '2026-08-05T03:00:00.000Z',
    },
    {
      handle: 'xiamu723',
      displayName: '夏目贵志',
      followedAgo: '7 days ago',
      followedAt: '2026-08-04T00:00:00.000Z',
    },
    {
      handle: 'stablequan',
      displayName: 'Quan Nguyen',
      followedAgo: '14 days ago',
      followedAt: '2026-07-28T00:00:00.000Z',
    },
    {
      handle: 'tuituiweb3',
      displayName: 'TUTU.图图',
      followedAgo: 'a month ago',
      followedAt: '2026-07-11T00:00:00.000Z',
    },
    {
      handle: 'qiuseoflove',
      displayName: '叶知秋',
      followedAgo: 'a month ago',
      followedAt: '2026-07-10T00:00:00.000Z',
    },
    {
      handle: 'yuguan1209',
      displayName: '鱼人#鱼馆',
      followedAgo: 'a month ago',
      followedAt: '2026-07-09T00:00:00.000Z',
    },
    {
      handle: 'tazmancrypto',
      displayName: 'Tazman',
      followedAgo: '2 months ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: 'champagneman',
      displayName: 'MJdata',
      followedAgo: '2 months ago',
      followedAt: '2026-06-10T00:00:00.000Z',
    },
    {
      handle: 'cryptoarte',
      displayName: 'CryptoArte',
      followedAgo: '2 months ago',
      followedAt: '2026-06-09T00:00:00.000Z',
    },
    {
      handle: '0xxiaoxiong',
      displayName: 'APESister Grace |Gate美股0费率',
      followedAgo: '2 months ago',
      followedAt: '2026-06-08T00:00:00.000Z',
    },
    {
      handle: '0xkakarot888',
      displayName: '0x卡卡撸特',
      followedAgo: '2 months ago',
      followedAt: '2026-06-07T00:00:00.000Z',
    },
    {
      handle: 'blockma',
      displayName: '区块马',
      followedAgo: '2 months ago',
      followedAt: '2026-06-06T00:00:00.000Z',
    },
    {
      handle: '0xsophia_baby',
      displayName: 'Sophia',
      followedAgo: '2 months ago',
      followedAt: '2026-06-05T00:00:00.000Z',
    },
    {
      handle: 'f0huazzz',
      displayName: 'FuHua',
      followedAgo: '2 months ago',
      followedAt: '2026-06-04T00:00:00.000Z',
    },
    {
      handle: '466anan',
      displayName: 'Crypto Nan',
      followedAgo: '2 months ago',
      followedAt: '2026-06-03T00:00:00.000Z',
    },
    {
      handle: 'bitcoin188',
      displayName: '比特币道',
      followedAgo: '2 months ago',
      followedAt: '2026-06-02T00:00:00.000Z',
    },
    {
      handle: 'jeery314159',
      displayName: 'Jeery314159 LFG',
      followedAgo: '2 months ago',
      followedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      handle: 'bitcoin136',
      displayName: '七喜 | 7UP',
      followedAgo: '2 months ago',
      followedAt: '2026-05-31T00:00:00.000Z',
    },
    {
      handle: 'laowu3677',
      displayName: 'Web3老吴',
      followedAgo: '2 months ago',
      followedAt: '2026-05-30T00:00:00.000Z',
    },
    {
      handle: '0xpipi',
      displayName: 'Pipi',
      followedAgo: '2 months ago',
      followedAt: '2026-05-29T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth',
      followedAgo: '2 months ago',
      followedAt: '2026-05-28T00:00:00.000Z',
    },
    {
      handle: 'oceansbaby_',
      displayName: 'Cruise橘子哥',
      followedAgo: '2 months ago',
      followedAt: '2026-05-27T00:00:00.000Z',
    },
  ],
  /**
   * Nam OK (@NamOK_bnb) — recent follows (X snapshot 2026-08-11).
   */
  namok_bnb: [
    {
      handle: 'flcjbtc',
      displayName: '飞龙财经',
      followedAgo: '3 months ago',
      followedAt: '2026-05-11T00:00:00.000Z',
    },
    {
      handle: 'definitivefi',
      displayName: 'DEFINITIVE',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
  ],
  /**
   * KT (@kt_btc) — recent follows (X snapshot 2026-08-11).
   */
  kt_btc: [
    {
      handle: 'qiuseoflove',
      displayName: '叶知秋',
      followedAgo: '4 days ago',
      followedAt: '2026-08-07T00:00:00.000Z',
    },
    {
      handle: 'bitcoinpalmer',
      displayName: 'palmer // not for everyone',
      followedAgo: '12 days ago',
      followedAt: '2026-07-30T00:00:00.000Z',
    },
    {
      handle: 'evans666666',
      displayName: 'Evans.eth',
      followedAgo: '2 months ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: 'renaissxyz',
      displayName: 'Renaiss.xyz',
      followedAgo: '3 months ago',
      followedAt: '2026-05-11T00:00:00.000Z',
    },
    {
      handle: 'erickpinos',
      displayName: 'Erick Pinos',
      followedAgo: '3 months ago',
      followedAt: '2026-05-10T00:00:00.000Z',
    },
    {
      handle: 'alpha_co',
      displayName: 'Alpha co',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
    {
      handle: 'joensmoon',
      displayName: '乔帮主退休月球收租',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
    {
      handle: 'cryptoamandal',
      displayName: '阿曼达要吃肉Amanda.eth',
      followedAgo: 'a year ago',
      followedAt: '2025-08-10T00:00:00.000Z',
    },
    {
      handle: '466anan',
      displayName: 'Crypto Nan',
      followedAgo: 'a year ago',
      followedAt: '2025-08-09T00:00:00.000Z',
    },
    {
      handle: 'defiapp',
      displayName: 'Defi App',
      followedAgo: 'a year ago',
      followedAt: '2025-08-08T00:00:00.000Z',
    },
    {
      handle: 'dakuan_x',
      displayName: '大匡',
      followedAgo: 'a year ago',
      followedAt: '2025-08-07T00:00:00.000Z',
    },
    {
      handle: 'daxianvip',
      displayName: '大仙 |Gate美股0费率',
      followedAgo: 'a year ago',
      followedAt: '2025-08-06T00:00:00.000Z',
    },
    {
      handle: 'jetxbt',
      displayName: 'Jet',
      followedAgo: 'a year ago',
      followedAt: '2025-08-05T00:00:00.000Z',
    },
    {
      handle: 'gala_nft1',
      displayName: 'gala⚡',
      followedAgo: 'a year ago',
      followedAt: '2025-08-04T00:00:00.000Z',
    },
    {
      handle: 'gala_nft2',
      displayName: 'gala⚡',
      followedAgo: 'a year ago',
      followedAt: '2025-08-03T00:00:00.000Z',
    },
  ],
  /**
   * Phạm Hương (@PhamHuong_GFI) — recent follows (X snapshot 2026-08-11).
   */
  phamhuong_gfi: [
    {
      handle: 'inkymaze',
      displayName: 'Nicholas Cannon',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
  ],
  /**
   * Tobi (@tobi24) — recent follows (X snapshot 2026-08-11).
   */
  tobi24: [
    {
      handle: 'fugui8',
      displayName: '香港王富贵',
      followedAgo: '10 months ago',
      followedAt: '2025-10-11T00:00:00.000Z',
    },
    {
      handle: 'sethipow',
      displayName: 'SETH AI Ecosystem',
      followedAgo: '10 months ago',
      followedAt: '2025-10-10T00:00:00.000Z',
    },
    {
      handle: 'afangyuan',
      displayName: '方源',
      followedAgo: 'a year ago',
      followedAt: '2025-08-11T00:00:00.000Z',
    },
    {
      handle: 'hongchen1476842',
      displayName: '彭鱼宴',
      followedAgo: 'a year ago',
      followedAt: '2025-08-10T00:00:00.000Z',
    },
    {
      handle: 'chinapumpwxc',
      displayName: '中国密码鲸公司 WHALE CHINESE',
      followedAgo: 'a year ago',
      followedAt: '2025-08-09T00:00:00.000Z',
    },
  ],
  /**
   * HC Gems Alert (@HCGemAlerts) — recent follows (X snapshot 2026-08-11).
   */
  hcgemalerts: [
    {
      handle: 'lc_hk0x',
      displayName: 'LC',
      followedAgo: '2 months ago',
      followedAt: '2026-06-11T00:00:00.000Z',
    },
    {
      handle: 'zama',
      displayName: 'Zama',
      followedAgo: '8 months ago',
      followedAt: '2025-12-11T00:00:00.000Z',
    },
  ],
}

/** Smart followers seed — key = KOL handle lowercase */
export const SMART_FOLLOWERS_BY_HANDLE: Record<string, SmartFollower[]> = {
  /**
   * Hên Vãi (@henvaibta) — curated smart network (Tier A/B review).
   * influenceScore: Tier A ≈ 800–900, Tier B ≈ 480–520 (sort proxy).
   */
  henvaibta: [
    {
      handle: 'NickyPham_HC',
      displayName: 'Nicky Pham',
      role: 'Tier A · Đồng sáng lập AlphaBack; crypto, trading, airdrop. Network lớn tại Việt Nam; cần lưu ý mô hình affiliate/hoàn phí',
      followers: 335_089,
      influenceScore: 900,
    },
    {
      handle: 'TNC404',
      displayName: 'TNC404',
      role: 'Tier A · Tài khoản thị trường/crypto từ 2016. Lâu năm, chỉ theo dõi 18 tài khoản; độ nổi bật cao nhưng bio không chứng minh chuyên môn cụ thể',
      followers: 135_804,
      influenceScore: 880,
    },
    {
      handle: 'TCVNcommunity',
      displayName: 'TradeCoinVN Community',
      role: 'Tier A · Cộng đồng TradeCoinVN. Smart network/media account, không phải một trader cá nhân',
      followers: 63_327,
      influenceScore: 860,
    },
    {
      handle: 'hanjiahnn',
      displayName: 'Hanjiahnn',
      role: 'Tier A · Trader, holder crypto và hàng hóa; founder TWH Group. Chuyên môn thị trường thể hiện rõ; chưa có PnL kiểm toán công khai',
      followers: 52_442,
      influenceScore: 840,
    },
    {
      handle: 'ShengMo0x',
      displayName: 'ShengMo',
      role: 'Tier A · Crypto từ 2013, mining, Bitcoin ecosystem. Hồ sơ lâu năm và ngách chuyên môn tương đối rõ',
      followers: 49_581,
      influenceScore: 820,
    },
    {
      handle: 'LuckyStudent02',
      displayName: 'Lucky Student',
      role: 'Tier A · Nội dung trading, quản lý vốn và tâm lý giao dịch. Có cộng đồng riêng; nên xem là trading educator/KOL, không mặc định là smart money',
      followers: 45_040,
      influenceScore: 800,
    },
    {
      handle: 'immihu',
      displayName: 'immihu',
      role: 'Tier B · Web3 builder; HCMC Blockchain Association; từng ở AmberBlocks. Có yếu tố builder và hệ sinh thái; giá trị nằm ở network hơn là dự báo giá',
      followers: 27_970,
      influenceScore: 520,
    },
    {
      handle: 'Tnubmv',
      displayName: 'Tnubmv',
      role: 'Tier B · Tài khoản giao dịch crypto. Tỷ lệ follower/following tốt nhưng bio quá mỏng, chưa đủ dữ liệu xếp Tier A',
      followers: 25_014,
      influenceScore: 500,
    },
    {
      handle: 'Airdrop_CSGroup',
      displayName: 'Airdrop CS Group',
      role: 'Tier B · Cộng đồng trading, news và airdrop. Có độ phủ cộng đồng nhưng thiên về phân phối nội dung',
      followers: 23_034,
      influenceScore: 480,
    },
  ],

  /** Martin (@Martin_bml) — SurfAI smart followers snapshot */
  martin_bml: [
    {
      handle: 'star_okx',
      displayName: 'Star Xu',
      role: 'Founder of OKX',
      followers: 234774,
      influenceScore: 917.36,
    },
    {
      handle: 'osf_rekt',
      displayName: 'OSF',
      role: 'Co-Founder, Rektguy AI',
      followers: 213343,
      influenceScore: 843.59,
    },
    {
      handle: 'ryandcrypto',
      displayName: 'ryandcrypto',
      role: 'KOL',
      followers: 241366,
      influenceScore: 839.97,
    },
    {
      handle: 'gracybitget',
      displayName: 'Gracy Chen',
      role: 'CEO of Bitget',
      followers: 285054,
      influenceScore: 766.26,
    },
    {
      handle: 'cozymaximalist',
      displayName: 'cozy',
      role: 'Director of Growth, Kuru',
      followers: 15077,
      influenceScore: 729.64,
    },
    {
      handle: 'xenbh',
      displayName: 'Xen',
      role: 'Head of Global Builders, Coinbase',
      followers: 24070,
      influenceScore: 726.36,
    },
    {
      handle: 'kmoney',
      displayName: 'kmoney',
      role: 'KOL',
      followers: 169120,
      influenceScore: 715.62,
    },
    {
      handle: 'andrewmoh',
      displayName: 'andrewmoh',
      role: 'KOL',
      followers: 53594,
      influenceScore: 702.7,
    },
    {
      handle: 'heyaura',
      displayName: 'heyAura',
      role: 'Chưa gắn nhãn',
      followers: 182556,
      influenceScore: 612.01,
    },
    {
      handle: 'aggrnews',
      displayName: 'Aggr News',
      role: 'KOL/news account',
      followers: 35557,
      influenceScore: 597.37,
    },
    {
      handle: 'boxmining',
      displayName: 'Boxmining',
      role: 'Investor/VC',
      followers: 177240,
      influenceScore: 559.29,
    },
    {
      handle: 'tinweb_3',
      displayName: 'Kutin',
      role: 'KOL',
      followers: 13632,
      influenceScore: 534.6,
    },
    {
      handle: '0xtindorr',
      displayName: 'Tindorr',
      role: 'KOL',
      followers: 44697,
      influenceScore: 534.31,
    },
    {
      handle: 'kisc_0',
      displayName: 'Afrolite',
      role: 'KOL',
      followers: 8636,
      influenceScore: 477.41,
    },
    {
      handle: 'airtightfish',
      displayName: 'Squid',
      role: 'Chưa gắn nhãn',
      followers: 7192,
      influenceScore: 475.92,
    },
    {
      handle: 'be_kindplss',
      displayName: 'be',
      role: 'Chưa gắn nhãn',
      followers: 10543,
      influenceScore: 466.74,
    },
    {
      handle: 'pinkbrains_io',
      displayName: 'Pink Brains',
      role: 'Project',
      followers: 15129,
      influenceScore: 460.24,
    },
    {
      handle: 'bobbybigyield',
      displayName: 'BOBBY',
      role: 'KOL',
      followers: 16619,
      influenceScore: 420.09,
    },
    {
      handle: 'tgd_duu',
      displayName: 'TGD Crypto',
      role: 'KOL',
      followers: 15607,
      influenceScore: 372.51,
    },
    {
      handle: 'imnotthewolf',
      displayName: 'imnotthewolf',
      role: 'Founder',
      followers: 63951,
      influenceScore: 358.53,
    },
    {
      handle: 'web3karina',
      displayName: 'Karina',
      role: 'Chưa gắn nhãn',
      followers: 6013,
      influenceScore: 290.04,
    },
    {
      handle: 'quanti_xbt',
      displayName: 'QuantuM',
      role: 'Chưa gắn nhãn',
      followers: 186494,
      influenceScore: 284.51,
    },
    {
      handle: 'sandyxbt',
      displayName: 'Sandy',
      role: 'Project',
      followers: 65205,
      influenceScore: 258.82,
    },
    {
      handle: 'zoraweb3',
      displayName: 'Zora',
      role: 'Chưa gắn nhãn',
      followers: 9992,
      influenceScore: 251.81,
    },
    {
      handle: 'shimal2i_eth',
      displayName: 'shimal2i_eth',
      role: 'Chưa gắn nhãn',
      followers: 10287,
      influenceScore: 234.62,
    },
    {
      handle: 'robin_t100',
      displayName: 'Robin τ',
      role: 'Chưa gắn nhãn / không được chấm điểm',
      followers: 11214,
      influenceScore: 0,
    },
  ],

  /**
   * Thiên Thiên (@Thienthien1305) — curated smart followers (signal review).
   * influenceScore ≈ độ mạnh tín hiệu (sort proxy).
   */
  thienthien1305: [
    {
      handle: 'calchulus',
      displayName: 'Calchulus',
      role: 'Mạnh nhất · Impossible Finance; từng làm tại Binance Research (2018–2021). Follow đã 4 năm, có nền tảng research/operator thực — nhưng follow ~18K nên độ chọn lọc không quá cao',
      influenceScore: 900,
    },
    {
      handle: 'xkonjin',
      displayName: 'xkonjin',
      role: 'Mạnh · Marketing tại Plasma; viết về stablecoin, privacy và machine intelligence. Đúng ngách infra crypto; điểm trừ: follow mới ~4 tháng và following khá rộng',
      influenceScore: 860,
    },
    {
      handle: 'paradex',
      displayName: 'Paradex',
      role: 'Mạnh (thương hiệu) · Tài khoản chính thức futures/options. Mutual + following thấp là tín hiệu tốt; có thể follow vì BD/community hơn đánh giá cá nhân',
      influenceScore: 820,
    },
    {
      handle: 'jampzey',
      displayName: 'Jampzey',
      role: 'Khá · Crypto creator/operator, liên quan R3ACH Network. Mạng lưới lớn, follow ~1 năm — nhưng follow gần 10K nên không nên xem là endorsement đặc biệt',
      influenceScore: 720,
    },
    {
      handle: 'wolfyxbt',
      displayName: 'WolfyXBT',
      role: 'Trung bình–khá · KOL crypto tiếng Trung (trading/meme, CHILABS). 856K followers + mutual là điểm cộng; nội dung đại chúng/quảng bá và following hàng nghìn',
      followers: 856_000,
      influenceScore: 650,
    },
    {
      handle: 'yuyue_chris',
      displayName: 'Yuyue Chris',
      role: 'Trung bình–khá · Angel investor; nội dung AI, crypto và trading. Có độ liên quan nhưng hồ sơ công khai chưa đủ để coi là endorsement đầu tư/research trọng lượng cao',
      influenceScore: 620,
    },
    {
      handle: 'darcydonavan',
      displayName: 'Darcy Donavan',
      role: 'Yếu · Diễn viên/nghệ sĩ/doanh nhân, có liên hệ NFT — không phải research crypto cốt lõi; follow ~88K nên chọn lọc rất thấp',
      influenceScore: 380,
    },
  ],
}

function readCachePayload(): {
  map?: Record<string, RecentFollower[]>
  smartMap?: Record<string, SmartFollower[]>
} | null {
  try {
    const raw = localStorage.getItem('vn-kol-map-recent-followers-v1')
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null
    return data as {
      map?: Record<string, RecentFollower[]>
      smartMap?: Record<string, SmartFollower[]>
    }
  } catch {
    return null
  }
}

/**
 * Server/cache mirror first (per handle), else compiled seed.
 * Cache is written only after successful R2 load/save — no standalone local admin store.
 */
export function getRecentFollowers(handle: string): RecentFollower[] {
  const key = handle.replace(/^@/, '').trim().toLowerCase()
  const cache = readCachePayload()
  if (cache) {
    let map: Record<string, RecentFollower[]> | null = null
    if (cache.map && typeof cache.map === 'object' && !Array.isArray(cache.map)) {
      map = cache.map
    } else if (!('map' in cache) && !('smartMap' in cache)) {
      map = cache as unknown as Record<string, RecentFollower[]>
    }
    if (map && key in map && Array.isArray(map[key])) {
      const list = map[key]
      if (list.length > 0) return list
    }
  }
  return RECENT_FOLLOWERS_BY_HANDLE[key] ?? []
}

export function getSmartFollowers(handle: string): SmartFollower[] {
  const key = handle.replace(/^@/, '').trim().toLowerCase()
  const cache = readCachePayload()
  if (
    cache?.smartMap &&
    typeof cache.smartMap === 'object' &&
    key in cache.smartMap &&
    Array.isArray(cache.smartMap[key])
  ) {
    const list = cache.smartMap[key]
    if (list.length > 0) return list
  }
  return SMART_FOLLOWERS_BY_HANDLE[key] ?? []
}

/** Show the Smart follower pill if either sub-list has data */
export function hasFollowerTabData(handle: string): boolean {
  return (
    getRecentFollowers(handle).length > 0 ||
    getSmartFollowers(handle).length > 0
  )
}
