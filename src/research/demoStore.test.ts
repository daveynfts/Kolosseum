// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { DEMO_DURATION } from './demoConfig'
beforeEach(() => { sessionStorage.clear(); vi.resetModules() })
it('resumes partial progress and distinguishes completion from a replay', async () => {
  const store = await import('./demoStore')
  store.saveDemoProgress(4321)
  vi.resetModules()
  const resumed = await import('./demoStore')
  expect(resumed.readDemoProgress()).toEqual({ elapsed: 4321, completedAt: null })
  expect(resumed.saveDemoProgress(DEMO_DURATION + 500).elapsed).toBe(DEMO_DURATION)
  expect(resumed.readDemoProgress().completedAt).toBeTruthy()
  expect(resumed.saveDemoProgress(0)).toEqual({ elapsed: 0, completedAt: null })
})
