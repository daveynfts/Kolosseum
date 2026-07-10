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
  tier: number
  kolCount: number
  handles: string[]
  postCount: number
  posts: FeedPost[]
}
