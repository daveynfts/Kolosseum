export interface FeedPost {
  id: string
  handle: string
  displayName: string
  text: string
  createdAt: string
  likes: number
  reposts: number
  replies: number
  views: number
  media: string[]
  isReply: boolean
  url: string
  avatarLocal: string
}

export interface Tier1Feed {
  generatedAt: string
  source: string
  mode: string
  /** 1 = T1 only; 12 = T1+T2 combined map feed */
  tier: number
  kolCount: number
  handles: string[]
  postCount: number
  /** Active posts (typically ≤ 7 days) */
  posts: FeedPost[]
  /** Posts moved out of the live feed (older than ~1 week) */
  archivedPosts?: FeedPost[]
  archivedCount?: number
}
