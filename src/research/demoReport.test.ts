import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { validateDemoReport } from './demoReport'
describe('public recorded demo', () => {
  it('contains the verified report and only public allow-listed fields', async () => {
    const fixture = JSON.parse(await readFile('public/demo/nbaluong.json', 'utf8'))
    const report = await validateDemoReport(fixture)
    expect(Object.keys(report).sort()).toEqual(['version','mode','handle','displayName','snapshotAt','recordedAt','postCount','sampledPosts','template','model','content','contentHash','sources'].sort())
    expect(report.sampledPosts).toBe(20)
    expect(report.sources).toHaveLength(20)
    expect(report.postCount).toBe(36)
    expect(report.content.match(/^## /gm)).toHaveLength(8)
    expect(report.mode).toBe('recorded-demo')
    await expect(validateDemoReport({ ...fixture, content: fixture.content + 'tampered' })).rejects.toThrow('integrity')
  })
  it('does not accept a different KOL or demo version', async () => {
    await expect(validateDemoReport({ handle: 'someone-else' })).rejects.toThrow('invalid')
  })
})
