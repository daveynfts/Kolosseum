import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production: radar.daveynfts.com (root base)
// Override if needed: VITE_BASE_PATH=/something/
const base = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: base.endsWith('/') ? base : `${base}/`,
  plugins: [react()],
})
