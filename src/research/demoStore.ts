import { DEMO_DURATION, DEMO_VERSION } from './demoConfig'
const KEY = 'kolosseum.demo.' + DEMO_VERSION
export type DemoProgress = { elapsed: number; completedAt: string | null }
let memory: DemoProgress | null = null
export function readDemoProgress(): DemoProgress {
  if (memory) return memory
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null') as DemoProgress | null
    if (parsed && Number.isFinite(parsed.elapsed)) return memory = { elapsed: Math.max(0, Math.min(DEMO_DURATION, parsed.elapsed)), completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null }
  } catch { /* storage can be unavailable */ }
  return memory = { elapsed: 0, completedAt: null }
}
export function saveDemoProgress(elapsed: number) {
  const previous = readDemoProgress()
  memory = { elapsed: Math.max(0, Math.min(DEMO_DURATION, elapsed)), completedAt: elapsed >= DEMO_DURATION ? previous.completedAt || new Date().toISOString() : null }
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* retain memory fallback */ }
  window.dispatchEvent(new Event('kolosseum-demo-progress'))
  return memory
}
