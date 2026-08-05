/**
 * Dynamic OG image for Conviction 2026 Side Events Map.
 * GET /api/og-conviction-events → PNG 1200×630
 */
import { ImageResponse } from '@vercel/og'

export const config = {
  runtime: 'edge',
}

export default async function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0,113,227,0.35) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(251,191,36,0.22) 0%, transparent 50%), linear-gradient(160deg, #0a0a0f 0%, #12141c 45%, #05060a 100%)',
          color: '#f5f5f7',
          fontFamily:
            'Inter, Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {/* Map-like pin grid decoration */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.35,
            backgroundImage:
              'radial-gradient(circle at 22% 42%, #38bdf8 0 4px, transparent 5px), radial-gradient(circle at 48% 55%, #fbbf24 0 5px, transparent 6px), radial-gradient(circle at 68% 38%, #a78bfa 0 4px, transparent 5px), radial-gradient(circle at 78% 62%, #34d399 0 3px, transparent 4px), radial-gradient(circle at 38% 68%, #f472b6 0 4px, transparent 5px)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: '#34c759',
                boxShadow: '0 0 12px #34c759',
              }}
            />
            DaveyNFTs · Event Map
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxWidth: 920,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                color: '#ffffff',
              }}
            >
              Conviction 2026
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              Side Events Map · TP.HCM
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.62)',
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Interactive map of side events — calendar, pins, distance & schedule
            conflicts · 14–15 Aug 2026 · Thiskyhall Sala
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            {[
              '14–15/08',
              'Side events',
              'Map · Timeline',
              'radar.daveynfts.com',
            ].map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  padding: '10px 18px',
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 650,
                  color: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, immutable, no-transform, max-age=86400',
      },
    },
  )
}
