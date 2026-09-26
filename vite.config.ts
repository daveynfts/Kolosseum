import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Production: radar.daveynfts.com (root base)
// Override if needed: VITE_BASE_PATH=/something/
const base = process.env.VITE_BASE_PATH || '/'

const radarReadOnlyPlugin: Plugin = {
  name: 'radar-read-only-dev-proxy',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (/^\/(?:api|r2)(?:\/|$)/.test(request.url || '') && !['GET', 'HEAD'].includes(request.method || '')) {
        response.statusCode = 405
        response.end('Local data proxy is read-only')
        return
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const researchEnabled = env.DEEP_RESEARCH_ENABLED === 'true'
  const radarProxy: ProxyOptions = {
    target: env.RADAR_API_BASE || 'https://radar.daveynfts.com',
    changeOrigin: true,
    secure: true,
    configure(proxy) {
      proxy.on('proxyReq', (request) => {
        request.removeHeader('authorization')
        request.removeHeader('cookie')
      })
    },
  }

  return {
    base: base.endsWith('/') ? base : `${base}/`,
    plugins: [react(), ...(researchEnabled ? [radarReadOnlyPlugin] : [])],
    // Only the boolean enters the client bundle; secrets stay in the sidecar.
    define: {
      __DEEP_RESEARCH_ENABLED__: JSON.stringify(researchEnabled),
      __SURF_DEMO_ENABLED__: JSON.stringify(env.SURF_DEMO_ENABLED !== 'false'),
    },
    resolve: { alias: [{ find: /^buffer$/, replacement: 'buffer/' }] },
    server: {
      proxy: researchEnabled ? {
        '/api': radarProxy,
        '/r2': radarProxy,
        '/dr-api': {
          target: env.RESEARCH_PROXY_TARGET || 'http://127.0.0.1:4174',
          changeOrigin: true,
          timeout: 300_000,
          proxyTimeout: 300_000,
          rewrite: (path: string) => path.replace(/^\/dr-api/, ''),
        },
      } : undefined,
    },
  }
})
