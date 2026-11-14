import { describe, expect, it } from 'vitest'
import { PRAISE, pickPraise } from './praise.ts'
import { buildVoiceManifest } from './voiceManifest.ts'

describe('praise', () => {
  it('names the most meaningful thing she did', () => {
    expect(pickPraise({ r: 'CLEAN', mystery: true, asked: true, seed: 0 }).key).toBe('mystery')
    expect(pickPraise({ r: 'CLEAN', comeback: true, asked: true, seed: 0 }).key).toBe('comeback')
    expect(pickPraise({ r: 'CLEAN', asked: true, pencil: true, seed: 0 }).key).toBe('askedFirst')
    expect(pickPraise({ r: 'CLEAN', pencil: true, seed: 0 }).key).toBe('pencil')
  })

  it('varies the everyday lines', () => {
    expect(new Set([0, 1, 2, 3].map((seed) => pickPraise({ r: 'CLEAN', seed }).key)).size).toBe(4)
    expect(new Set([0, 1, 2].map((seed) => pickPraise({ r: 'MISSED', seed }).key)).size).toBe(3)
  })

  it('never calls a miss wrong, and never praises being clever', () => {
    for (const text of Object.values(PRAISE)) expect(text).not.toMatch(/wrong|incorrect|clever|genius|smartest|bad/i)
    expect(pickPraise({ r: 'MISSED', close: true, seed: 0 }).text).toMatch(/start exactly right/)
    expect(pickPraise({ r: 'HELPED', seed: 0 }).text).toMatch(/kept going/)
  })

  it('has a recording listed for every line', () => {
    const keys = new Set(buildVoiceManifest().clips.map((c) => c.key))
    for (const key of Object.keys(PRAISE) as (keyof typeof PRAISE)[]) {
      expect(keys.has(pickPraise({ r: 'CLEAN', seed: 0 }).clip)).toBe(true)
      expect(keys.has(`t/${''}`)).toBe(false)
      void key
    }
    for (const text of Object.values(PRAISE)) {
      expect([...buildVoiceManifest().clips].some((c) => c.text === text)).toBe(true)
    }
  })
})

describe('pacing of stitched lines', () => {
  it('pauses longest between letter names', async () => {
    const { pauseBefore } = await import('./clips.ts')
    expect(pauseBefore('l/d', 'l/a')).toBeGreaterThan(pauseBefore('t/abc', 'l/d'))
    expect(pauseBefore('t/abc', 'l/d')).toBeGreaterThan(pauseBefore('t/abc', 'w/dancing'))
    expect(pauseBefore('t/abc', 'w/dancing')).toBeGreaterThan(100)
  })
})
