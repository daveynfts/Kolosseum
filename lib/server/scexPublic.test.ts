import { describe, expect, it } from 'vitest'
import { publicScexDataset } from './scexPublic.js'

describe('publicScexDataset', () => {
  it('drops hidden posts and admin-only fields', () => {
    const pub = publicScexDataset({
      actors: [
        {
          handle: 'a',
          scoreLog: 'secret',
          radarNote: 'n',
          trackingCode: 'x',
        },
      ],
      posts: [
        { id: '1', hidden: true, notes: 'admin', text: 'hide' },
        { id: '2', notes: 'keep-out', text: 'pub' },
      ],
    })
    expect(pub.posts).toHaveLength(1)
    expect(pub.posts[0].notes).toBeUndefined()
    expect(pub.posts[0].hidden).toBeUndefined()
    expect(pub.actors[0].scoreLog).toBeUndefined()
    expect(pub.actors[0].radarNote).toBeUndefined()
    expect(pub.actors[0].trackingCode).toBeUndefined()
  })
})
