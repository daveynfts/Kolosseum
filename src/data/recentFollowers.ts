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
}

/**
 * Prefer admin localStorage override when present (see recentFollowersStore).
 * Falls back to compiled seed map.
 */
export function getRecentFollowers(handle: string): RecentFollower[] {
  const key = handle.replace(/^@/, '').trim().toLowerCase()
  try {
    const raw = localStorage.getItem('vn-kol-map-recent-followers-v1')
    if (raw) {
      const map = JSON.parse(raw) as Record<string, RecentFollower[]>
      if (map && typeof map === 'object' && Array.isArray(map[key])) {
        return map[key]
      }
      // Override exists but this handle empty → intentionally no list
      if (map && typeof map === 'object' && key in map) return map[key] ?? []
      // If override map exists, only show keys in override (admin full replace)
      if (map && typeof map === 'object' && Object.keys(map).length > 0) {
        return map[key] ?? []
      }
    }
  } catch {
    /* fall through to seed */
  }
  return RECENT_FOLLOWERS_BY_HANDLE[key] ?? []
}
