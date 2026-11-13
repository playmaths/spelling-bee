import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/index.ts'
import { createJudge, judgeReducer, type JudgeState } from '../engine/judgeStateMachine.ts'
import { plainForVoice } from '../engine/voice.ts'
import { buildVoiceManifest } from './voiceManifest.ts'

const manifest = buildVoiceManifest()
const byKey = new Map(manifest.clips.map((c) => [c.key, c]))

// CI writes the recording list with: AUDIO_MANIFEST_OUT=audio-manifest.json npx vitest run src/lib/clips.test.ts
if (process.env.AUDIO_MANIFEST_OUT) writeFileSync(process.env.AUDIO_MANIFEST_OUT, JSON.stringify(manifest))

/** What the stitched recordings say, as plain lowercase words. */
const said = (keys: string[]) =>
  keys.map((k) => byKey.get(k)!.text).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const words = (text: string) =>
  plainForVoice(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function expectRecorded(state: JudgeState) {
  const { clips, spoken } = state.line
  expect(clips, spoken).toBeTruthy()
  for (const key of clips!) expect(byKey.has(key), `${key} for "${spoken}"`).toBe(true)
  // The recordings must say what the text says (ignoring punctuation, and the letter-by-letter dashes).
  expect(said(clips!)).toBe(words(spoken))
}

describe('recording list', () => {
  it('has no duplicate keys and no empty texts', () => {
    expect(byKey.size).toBe(manifest.clips.length)
    for (const c of manifest.clips) expect(c.text.trim()).not.toBe('')
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s: everything the Judge can say is recorded', (_, w) => {
    for (const mode of ['CONTEST', 'ADVENTURE'] as const) {
      // Questions (twice, to cycle meanings and clues).
      let s = createJudge(w, mode)
      for (const intent of ['REPEAT', 'SLOW', 'SENTENCE', 'DEFINITION', 'CLUE'] as const) {
        for (let i = 0; i < 2; i++) {
          s = judgeReducer(s, { type: 'INTENT', intent })
          expectRecorded(s)
        }
      }
      // Right first time.
      expectRecorded(judgeReducer(createJudge(w, mode), { type: 'SUBMIT', attempt: w.word }))
      // Every authored trap, and a spread of other mistakes, three times each (nudge, reveal, give up).
      const end = w.word.length - 1
      const swap = (i: number) => w.word.slice(0, i) + (w.word[i] === 'q' ? 'x' : 'q') + w.word.slice(i + 1)
      const attempts = [
        ...w.traps.map((t) => t.misspelling),
        swap(0),
        swap(1),
        swap(end),
        w.word + 'zz',
        w.word.slice(0, -1),
        w.word.slice(1),
        w.word[1] + w.word[0] + w.word.slice(2),
        w.word.replace(/[aeiou]/, ''),
      ].filter((a) => a && a !== w.word)
      for (const attempt of attempts) {
        let t = createJudge(w, mode)
        for (let i = 0; i < 3 && t.phase !== 'RESOLVED'; i++) {
          t = judgeReducer(t, { type: 'SUBMIT', attempt })
          expectRecorded(t)
        }
        // ...and fixing it afterwards.
        if (t.phase !== 'RESOLVED') expectRecorded(judgeReducer(t, { type: 'SUBMIT', attempt: w.word }))
      }
    }
  })
})
