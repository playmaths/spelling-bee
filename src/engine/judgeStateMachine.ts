import { getCard } from '../data/index.ts'
import type { BeeWord, ErrorBucket, GameMode } from '../types/game.ts'
import { classifyAttempt, isVowel, normalizeAttempt, type Diagnosis } from './diagnosticClassifier.ts'
import {
  beatsPhrase,
  boxPhrase,
  definitionClip,
  phrase,
  sayText,
  sentenceClip,
  slowWordClip,
  spellClips,
  wordClip,
} from './voice.ts'

/**
 * Capability 1 — Deterministic Conversational Judge.
 * A pure reducer: (state, event) -> state. No timers, randomness, or I/O, so the
 * same inputs always produce the same Judge line and the same grade.
 */

// ---------------------------------------------------------------------------
// INTENT_STREAM
// ---------------------------------------------------------------------------

export type JudgeIntent = 'DEFINITION' | 'SENTENCE' | 'SLOW' | 'CLUE' | 'REPEAT'

const INTENT_RULES: [JudgeIntent, RegExp][] = [
  ['SENTENCE', /\bsentence\b/],
  ['DEFINITION', /\b(mean|means|meaning|definition|define)\b/],
  ['SLOW', /\b(slow|slowly|slower)\b/],
  ['CLUE', /\b(clue|clues|hint|root|roots|origin|come from|comes from)\b/],
  ['REPEAT', /\b(repeat|again|say it|say the word|pronounce)\b/],
]

/** Maps a spoken or tapped request to an intent, or null if it is not a request. */
export function parseIntent(utterance: string): JudgeIntent | null {
  const text = utterance.toLowerCase().replace(/[^a-z\s]/g, ' ')
  return INTENT_RULES.find(([, re]) => re.test(text))?.[0] ?? null
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type JudgePhase = 'AWAITING_SPELLING' | 'COACHING' | 'RESOLVED'

export type JudgeLineKind =
  | 'PROMPT'
  | 'INTENT_REPLY'
  | 'COACHING'
  | 'TWIN_ALERT'
  | 'CORRECT'
  | 'INCORRECT'

export interface JudgeLine {
  kind: JudgeLineKind
  /** What the Judge says out loud (may contain the target word). */
  spoken: string
  /** What appears in the dialogue bubble (never leaks the word before it is resolved). */
  display: string
  /** Speak at slow rate. */
  slow?: boolean
  /** Recordings that, played in order, say this line (see src/engine/voice.ts). */
  clips?: string[]
}

/** Queued for the post-round Coach's Corner (CONTEST) and the pattern engine. */
export interface CoachNote {
  wordId: string
  patternId: string | null
  bucket: ErrorBucket
  attempt: string
  coaching: string
  memoryTrick: string | null
}

export interface JudgeState {
  mode: GameMode
  word: BeeWord
  phase: JudgePhase
  line: JudgeLine
  /** Number of graded submissions so far. */
  attempts: number
  outcome: 'CORRECT' | 'INCORRECT' | null
  /** Correct on the very first submission with no coaching. */
  firstTryUnassisted: boolean
  /** False while every miss so far was a zero-penalty UK/US variant. */
  streakPenalty: boolean
  highlightTileIndex: number | null
  /** Twin-Choice bubbles to offer for the highlighted tile (ADVENTURE only). */
  candidatePair: [string, string] | null
  lastDiagnosis: Diagnosis | null
  diagnoses: Diagnosis[]
  /** Free requests made; feeds curiosity telemetry, never scoring. */
  intentCounts: Record<JudgeIntent, number>
  coachNote: CoachNote | null
}

export type JudgeEvent =
  | { type: 'INTENT'; intent: JudgeIntent }
  | { type: 'SUBMIT'; attempt: string }

/** In ADVENTURE the Judge shows the answer after this many misses. */
export const MAX_ADVENTURE_ATTEMPTS = 3

const spellOut = (word: string) => word.toUpperCase().split('').join('-')
const bold = (s: string) => `**${s}**`

export function createJudge(word: BeeWord, mode: GameMode): JudgeState {
  return {
    mode,
    word,
    phase: 'AWAITING_SPELLING',
    line: {
      kind: 'PROMPT',
      spoken: `Your word is ${word.word}.`,
      display: 'Tap “Hear the word” when you are ready. You can also ask me what it means or to use it in a sentence.',
    },
    attempts: 0,
    outcome: null,
    firstTryUnassisted: false,
    streakPenalty: false,
    highlightTileIndex: null,
    candidatePair: null,
    lastDiagnosis: null,
    diagnoses: [],
    intentCounts: { DEFINITION: 0, SENTENCE: 0, SLOW: 0, CLUE: 0, REPEAT: 0 },
    coachNote: null,
  }
}

// ---------------------------------------------------------------------------
// Line templates
// ---------------------------------------------------------------------------

function intentLine(state: JudgeState, intent: JudgeIntent): JudgeLine {
  const { word } = state
  // Repeated asks cycle through the word's meanings.
  const meaningIndex = state.intentCounts[intent] % word.meanings.length
  const meaning = word.meanings[meaningIndex]
  const beats = word.syllables.length
  switch (intent) {
    case 'DEFINITION': {
      const text = `It's ${/^[aeiou]/.test(meaning.partOfSpeech) ? 'an' : 'a'} ${meaning.partOfSpeech}. ${meaning.kidDefinition}`
      return { kind: 'INTENT_REPLY', spoken: text, display: text, clips: [definitionClip(word.word, meaningIndex)] }
    }
    case 'SENTENCE':
      return {
        kind: 'INTENT_REPLY',
        spoken: meaning.exampleSentence,
        display: meaning.blankedSentence,
        clips: [sentenceClip(word.word, meaningIndex)],
      }
    case 'SLOW':
      return {
        kind: 'INTENT_REPLY',
        spoken: word.word,
        display: `🔊 Nice and slow… listen for ${beats} ${beats === 1 ? 'beat' : 'beats'}.`,
        slow: true,
        clips: [slowWordClip(word.word)],
      }
    case 'CLUE': {
      // Concrete clues, never "it's a noun with 3 beats":
      // first, words that mean nearly the same; then (while learning only) a nudge
      // about the tricky part. The bee stage gives meaning clues only, never spelling help.
      const synonyms = (getCard(word.id)?.synonyms ?? []).filter((x) => !new RegExp(`\\b${word.word}\\b`, 'i').test(x))
      const hint = word.graphemeMap.find((c) => c.isPatternFocus && c.coachingHint)?.coachingHint
      const clues: { spoken: string; display: string; clips: string[] }[] = []
      if (synonyms.length > 0) {
        const list = synonyms.map((x) => `“${x}”`).join(' or ')
        const text = `Here's a clue. It means nearly the same as ${list}.`
        clues.push({ spoken: text, display: text, clips: [sayText(text)] })
      }
      if (state.mode === 'ADVENTURE' && hint) {
        clues.push({
          spoken: `Here's a clue about the tricky part. ${hint}`,
          display: `Here's a clue about the tricky part. ${hint.replace(new RegExp(`\\b${word.word}\\b`, 'gi'), 'this word')}`,
          clips: [phrase('clueTricky'), sayText(hint)],
        })
      }
      if (clues.length === 0) {
        const text = `Here's a clue. ${meaning.kidDefinition}`
        clues.push({ spoken: text, display: text, clips: [sayText(text)] })
      }
      const clue = clues[state.intentCounts.CLUE % clues.length]
      return { kind: 'INTENT_REPLY', ...clue }
    }
    case 'REPEAT':
      return { kind: 'INTENT_REPLY', spoken: word.word, display: '🔊 Here it is again!', clips: [wordClip(word.word)] }
  }
}

/** First-miss nudge: points at the first mismatch without giving the letter away. */
function nudgeLine(word: BeeWord, d: Diagnosis): JudgeLine {
  const index = d.errorTileIndex ?? 0
  const opener = "Nice attempt! Let's check your spelling."
  const w = wordClip(word.word)
  const make = (rest: (name: string) => string, clips: string[]): JudgeLine => ({
    kind: 'COACHING',
    spoken: `${opener} ${rest(word.word)}`,
    display: `${opener} ${rest('this word')}`,
    clips: [phrase('nice'), ...clips],
  })

  if (d.bucket === 'SYLLABLE_OMISSION') {
    const beats = word.syllables.length
    return make(
      (name) =>
        `I think a beat went missing! Clap ${bold(name)} slowly — it has ${beats} ${beats === 1 ? 'beat' : 'beats'}. Which sound did we skip?`,
      [phrase('beatMissing'), w, sayText(beatsPhrase(beats))],
    )
  }
  if (d.bucket === 'MOTOR_SLIP' && d.attempt.length === word.word.length) {
    return make(
      () => `So close! Take another look at box ${index + 1} — I think your hand slipped there.`,
      [sayText(boxPhrase(index + 1))],
    )
  }
  if (index === 0) {
    const hint = d.chunk?.isPatternFocus ? d.chunk.coachingHint : undefined
    return make(
      (name) => hint ?? `Listen to the very beginning of ${bold(name)}. Can you figure out which letter comes first?`,
      hint ? [sayText(hint)] : [phrase('listenBeginning'), w, phrase('whichFirst')],
    )
  }
  const good = word.word.slice(0, index).toUpperCase()
  const lead =
    index === 1
      ? `The first letter of ${'{name}'} is ${bold(good)}`
      : `${'{name}'} starts with ${bold(spellOut(good))}`
  const expected = word.word[index]
  const ask =
    expected === undefined
      ? 'but I think there are too many letters. Which one can go?'
      : `but listen to the next sound. Can you figure out which ${isVowel(expected) ? 'vowel' : 'letter'} comes next?`
  const askClip = phrase(expected === undefined ? 'tooMany' : isVowel(expected) ? 'butVowel' : 'butLetter')
  return make(
    (name) => `${lead.replace('{name}', bold(name))}, ${ask}`,
    index === 1
      ? [phrase('firstLetterOf'), w, phrase('is'), ...spellClips(good), askClip]
      : [w, phrase('startsWith'), ...spellClips(good), askClip],
  )
}

/** Second-miss (or twin-alert) line: the authored trap response plus its memory trick. */
function trapLine(d: Diagnosis): JudgeLine {
  const trap = d.matchedTrap!
  const twin = d.bucket === 'UK_US_VARIANT_TRAP'
  const text = `${twin ? 'British/American Twin Alert! ' : ''}${trap.judgeResponse} ${trap.memoryTrick}`
  return {
    kind: twin ? 'TWIN_ALERT' : 'COACHING',
    spoken: text,
    display: text,
    clips: [...(twin ? [phrase('twinAlert')] : []), sayText(trap.judgeResponse), sayText(trap.memoryTrick)],
  }
}

function coachNoteFor(word: BeeWord, d: Diagnosis): CoachNote {
  return {
    wordId: word.id,
    patternId: d.patternId,
    bucket: d.bucket,
    attempt: d.attempt,
    coaching: d.matchedTrap?.judgeResponse ?? d.chunk?.coachingHint ?? `${word.word} is spelled ${spellOut(word.word)}.`,
    memoryTrick: d.matchedTrap?.memoryTrick ?? null,
  }
}

// ---------------------------------------------------------------------------
// EVALUATION_ENGINE + reducer
// ---------------------------------------------------------------------------

export function judgeReducer(state: JudgeState, event: JudgeEvent): JudgeState {
  if (event.type === 'INTENT') {
    // Curiosity is always free: no phase change, no penalty, in either mode.
    return {
      ...state,
      line: intentLine(state, event.intent),
      intentCounts: {
        ...state.intentCounts,
        [event.intent]: state.intentCounts[event.intent] + 1,
      },
    }
  }

  if (state.phase === 'RESOLVED' || normalizeAttempt(event.attempt) === '') return state

  const { word, mode } = state
  const d = classifyAttempt(word, event.attempt)
  const attempts = state.attempts + 1
  const base: JudgeState = {
    ...state,
    attempts,
    lastDiagnosis: d,
    diagnoses: [...state.diagnoses, d],
    streakPenalty: state.streakPenalty || d.streakPenalty,
    highlightTileIndex: null,
    candidatePair: null,
  }
  const spelled = `${bold(word.word)} is spelled ${spellOut(word.word)}.`
  const spelledClips = [wordClip(word.word), phrase('isSpelled'), ...spellClips(word.word)]

  if (d.isCorrect) {
    const text =
      mode === 'CONTEST'
        ? `That is correct! ${spelled}`
        : attempts === 1
          ? `You got it on the first try! ${spelled}`
          : `That's it — you fixed it yourself! ${spelled}`
    return {
      ...base,
      phase: 'RESOLVED',
      outcome: 'CORRECT',
      firstTryUnassisted: attempts === 1,
      line: {
        kind: 'CORRECT',
        spoken: text,
        display: text,
        clips: [phrase(mode === 'CONTEST' ? 'correct' : attempts === 1 ? 'firstTry' : 'fixedIt'), ...spelledClips],
      },
    }
  }

  if (mode === 'CONTEST') {
    // No mid-word correction: one submission, graded, review deferred to Coach's Corner.
    const twin = d.bucket === 'UK_US_VARIANT_TRAP'
    const text = `🔔 I'm sorry, that is not the spelling we use in this bee. ${spelled}${
      twin ? " That was the British spelling, so your streak is safe!" : ''
    }`
    return {
      ...base,
      phase: 'RESOLVED',
      outcome: 'INCORRECT',
      coachNote: coachNoteFor(word, d),
      line: {
        kind: 'INCORRECT',
        spoken: text,
        display: text,
        clips: [phrase('sorry'), ...spelledClips, ...(twin ? [phrase('twinSafe')] : [])],
      },
    }
  }

  // ADVENTURE
  if (attempts >= MAX_ADVENTURE_ATTEMPTS) {
    const trick = d.matchedTrap?.memoryTrick ?? word.traps[0]?.memoryTrick
    const text = `Great effort — this one is tricky! ${spelled}${trick ? ` ${trick}` : ''} We'll meet it again soon.`
    return {
      ...base,
      phase: 'RESOLVED',
      outcome: 'INCORRECT',
      coachNote: coachNoteFor(word, d),
      line: {
        kind: 'INCORRECT',
        spoken: text,
        display: text,
        clips: [phrase('greatEffort'), ...spelledClips, ...(trick ? [sayText(trick)] : []), phrase('meetAgain')],
      },
    }
  }

  // Twin alerts reveal straight away; other traps get a nudge first, then the full response.
  const reveal =
    d.matchedTrap !== null && (d.bucket === 'UK_US_VARIANT_TRAP' || attempts >= 2)
  return {
    ...base,
    phase: 'COACHING',
    highlightTileIndex: d.errorTileIndex,
    candidatePair: reveal ? (d.matchedTrap!.candidatePair ?? null) : null,
    line: reveal ? trapLine(d) : nudgeLine(word, d),
  }
}
