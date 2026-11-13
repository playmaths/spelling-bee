import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/index.ts'
import { createJudge, judgeReducer } from '../engine/judgeStateMachine.ts'
import { clipKeys } from './clips.ts'

/** The recording list made for CI must agree with the keys and texts the app asks for. */
const manifest = JSON.parse(execFileSync('node', ['scripts/audio-manifest.mjs'], { maxBuffer: 64e6 }).toString()) as {
  clips: { key: string; text: string; speed: number }[]
}
const byKey = new Map(manifest.clips.map((c) => [c.key, c]))

describe('recording list', () => {
  it('has no duplicate keys', () => {
    expect(byKey.size).toBe(manifest.clips.length)
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s: every line the Judge can say has a matching recording', (_, w) => {
    let s = createJudge(w, 'CONTEST')
    for (const intent of ['REPEAT', 'SLOW', 'SENTENCE', 'DEFINITION'] as const) {
      for (let i = 0; i < w.meanings.length; i++) {
        s = judgeReducer(s, { type: 'INTENT', intent })
        const clip = byKey.get(s.line.clip!)
        expect(clip, s.line.clip).toBeTruthy()
        expect(clip!.text).toBe(s.line.spoken)
      }
    }
    expect(byKey.get(clipKeys.secret(w.word))!.text).toBe(`What is the secret of ${w.word}?`)
    expect(byKey.has(clipKeys.card(w.word))).toBe(true)
    expect(byKey.get(clipKeys.slowWord(w.word))!.speed).toBeLessThan(byKey.get(clipKeys.word(w.word))!.speed)
  })
})
