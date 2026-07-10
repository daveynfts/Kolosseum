import { Redis } from '@upstash/redis'

/** Trim + strip accidental wrapping quotes from Vercel UI paste. */
export function env(name: string): string {
  const v = process.env[name]
  if (!v) return ''
  return v.trim().replace(/^["']|["']$/g, '')
}

export function pickRedisCreds(): { url: string; token: string } {
  const url =
    env('UPSTASH_REDIS_REST_URL') ||
    env('KV_REST_API_URL') ||
    env('UPSTASH_REDIS_URL') ||
    ''
  const token =
    env('UPSTASH_REDIS_REST_TOKEN') ||
    env('KV_REST_API_TOKEN') ||
    env('UPSTASH_REDIS_TOKEN') ||
    ''
  return { url, token }
}

export function redisClient(): Redis | null {
  const { url, token } = pickRedisCreds()
  if (!url || !token) return null
  if (!url.includes('upstash') && !url.startsWith('http')) return null
  return new Redis({ url, token })
}

export function envPresence() {
  return {
    UPSTASH_REDIS_REST_URL: !!env('UPSTASH_REDIS_REST_URL'),
    UPSTASH_REDIS_REST_TOKEN: !!env('UPSTASH_REDIS_REST_TOKEN'),
    KV_REST_API_URL: !!env('KV_REST_API_URL'),
    KV_REST_API_TOKEN: !!env('KV_REST_API_TOKEN'),
    FEED_ADMIN_TOKEN: !!env('FEED_ADMIN_TOKEN'),
    VERCEL_ENV: process.env.VERCEL_ENV || null,
  }
}
