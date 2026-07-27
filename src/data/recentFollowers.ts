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
      return map[key]
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
    return cache.smartMap[key]
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
