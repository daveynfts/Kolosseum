/**
 * Social crawlers (Telegram, etc.) get static OG HTML (no serverless fn —
 * Hobby plan cap is 12 functions).
 * Real users continue to the Vite SPA via vercel.json rewrite.
 */
import { rewrite, next } from '@vercel/functions'

// Only known social crawlers — avoid bare "Preview" (can match real browsers).
const BOT_UA =
  /TelegramBot|twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Discordbot|WhatsApp|redditbot|Pinterest|vkShare|SkypeUriPreview|Embedly|Iframely|Slack-ImgProxy|Quora Link Preview|Showyoubot|outbrain|W3C_Validator|Qwantify|bitlybot|nuzzel|Googlebot|bingbot|Applebot|Baiduspider|YandexBot|DuckDuckBot|Slurp|Viber|line-poker|SteamChatURLLookup|Discordbot|Xing-preview|ZoominfoBot/i

export const config = {
  matcher: ['/event', '/event/(.*)'],
}

export default function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || ''
  if (BOT_UA.test(ua)) {
    // Static file in public/ — does not count toward Hobby serverless limit
    return rewrite(new URL('/event-preview.html', request.url))
  }
  // Humans: fall through to static SPA + vercel.json /event rewrite
  return next()
}
