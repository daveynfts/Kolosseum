import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed under daveynfts.com/vietnamkolradar/
// Override: VITE_BASE_PATH=/ for standalone preview if needed
const base = process.env.VITE_BASE_PATH || '/vietnamkolradar/'

// https://vite.dev/config/
export default defineConfig({
  base: base.endsWith('/') ? base : `${base}/`,
  plugins: [react()],
})
