import { CARDS, WORDS } from '../data/index.ts'
import {
  MAX_BEATS,
  MAX_BOXES,
  PHRASES,
  beatsPhrase,
  boxPhrase,
  cardClip,
  definitionClip,
  letterClip,
  plainForVoice,
  sayText,
  secretClip,
  sentenceClip,
  slowWordClip,
  wordClip,
} from '../engine/voice.ts'

import { STAGE_LINES } from './awards.ts'
import { PRAISE } from './praise.ts'

export interface VoiceClip {
  key: string
  text: string
  speed: number
}

const NORMAL = 0.9
/** A word said on its own, as a bee pronouncer says it: unhurried and clear. */
const WORD = 0.75
const SLOW = 0.55

export const TRIAL_WORD = 'practice'
/** Ways of recording a single word, to be compared by ear on a real phone. */
export const VOICE_TRIALS = [
  { id: 'a', label: 'A', speed: 0.75 }, // as used now: slow, cut tight
  { id: 'b', label: 'B', speed: 0.9 }, // a little faster, cut tight
  { id: 'c', label: 'C', speed: 1.0 }, // normal speed, cut tight
  { id: 'd', label: 'D', speed: 0.75 }, // slow, with a quiet moment before and after
  { id: 'e', label: 'E', speed: 0.75 }, // slow, exactly as the voice model gives it
] as const

/**
 * Every recording the app can ask for, most important first. CI records this list
 * (scripts/generate_audio.py). Built from the same code the app uses to choose
 * clips, so the two cannot drift apart.
 */
export function buildVoiceManifest(): { voice: string; clips: VoiceClip[] } {
  const clips = new Map<string, VoiceClip>()
  const add = (key: string, text: string, speed = NORMAL) => {
    const plain = plainForVoice(text)
    if (plain && !clips.has(key)) clips.set(key, { key, text: plain, speed })
  }
  const say = (text: string) => add(sayText(text), text)
  const article = (pos: string) => (/^[aeiou]/.test(pos) ? 'an' : 'a')
  const cardOf = new Map(CARDS.map((c) => [c.wordId, c]))

  for (const w of WORDS) {
    add(wordClip(w.word), w.word, WORD)
    add(slowWordClip(w.word), w.word, SLOW)
  }
  for (const l of 'abcdefghijklmnopqrstuvwxyz') add(letterClip(l), l.toUpperCase())
  for (const text of Object.values(PHRASES)) say(text)
  for (const text of Object.values(PRAISE)) say(text)
  for (const text of STAGE_LINES) say(text)
  for (let n = 1; n <= MAX_BEATS; n++) say(beatsPhrase(n))
  for (let n = 1; n <= MAX_BOXES; n++) say(boxPhrase(n))

  for (const w of WORDS) {
    w.meanings.forEach((m, i) => {
      add(sentenceClip(w.word, i), m.exampleSentence)
      add(definitionClip(w.word, i), `It's ${article(m.partOfSpeech)} ${m.partOfSpeech}. ${m.kidDefinition}`)
    })
    add(secretClip(w.word), `What is the secret of ${w.word}?`)
  }
  for (const w of WORDS) {
    for (const t of w.traps) {
      say(t.judgeResponse)
      say(t.memoryTrick)
    }
    for (const c of w.graphemeMap) if (c.coachingHint) say(c.coachingHint)
    const synonyms = (cardOf.get(w.id)?.synonyms ?? []).filter((x) => !new RegExp(`\\b${w.word}\\b`, 'i').test(x))
    if (synonyms.length > 0) {
      say(`Here's a clue. It means nearly the same as ${synonyms.map((x) => `“${x}”`).join(' or ')}.`)
    } else {
      for (const m of w.meanings) say(`Here's a clue. ${m.kidDefinition}`)
    }
  }
  for (const w of WORDS) {
    const card = cardOf.get(w.id)
    if (card) add(cardClip(w.word), card.sentence)
  }
  for (const w of WORDS) say(w.wordStory)

  // Five takes of one word, for the grown-ups' "Compare recordings" check.
  // The recording script treats each letter differently (see VARIANTS there).
  for (const v of VOICE_TRIALS) add(`v/${v.id}-${TRIAL_WORD}`, TRIAL_WORD, v.speed)
  return { voice: 'af_heart', clips: [...clips.values()] }
}
