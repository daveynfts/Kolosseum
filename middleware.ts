/**
 * Serve crawler-friendly OG HTML for /event/* (Telegram, Twitter, etc.).
 * Humans keep the Vite SPA rewrite.
 */
import { rewrite, next } from '@vercel/functions'

const BOT_UA =
  /TelegramBot|twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Discordbot|WhatsApp|redditbot|Pinterest|vkShare|SkypeUriPreview|Applebot|Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|Embedly|Quora Link Preview|Showyoubot|outbrain|W3C_Validator|Qwantify|bitlybot|nuzzel|Discordbot|Google Page Speed|Bitrix link preview|Xing-preview|ZoominfoBot|Viber|line-poker|Iframely|SteamChatURLLookup/i

export const config = {
  matcher: ['/event', '/event/(.*)'],
}

export default function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || ''
  if (BOT_UA.test(ua)) {
    const url = new URL(request.url)
    // Static preview page with correct OG tags + image
    return rewrite(new URL('/event-preview.html', url.origin))
  }
  return next()
}
