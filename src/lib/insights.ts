import { PATTERNS, getPattern, getWord } from '../data/index.ts'
import { calibrationFor } from './awards.ts'
import type { Attempt, Progress } from './unlocks.ts'

/**
 * The parent report: what her attempts say about strengths, what to work on,
 * and what to do about it. Pure and deterministic, so the same history always
 * gives the same report. It only knows what was logged; see `enough`.
 */
export interface FamilyStat {
  patternId: string
  title: string
  secret: string
  attempts: number
  clean: number
  /** Share right first time with no help, 0-1. */
  rate: number
  /** Words in this family she did not get clean, most recent first. */
  struggled: string[]
}

export interface Insights {
  /** False until there is enough to say anything fair (10 attempts). */
  enough: boolean
  attempts: number
  daysPlayed: number
  wordsSolved: number
  /** Right first time with no help, over everything and over the last 15. */
  cleanRate: number | null
  recentRate: number | null
  /** The difficulty the app is aiming her words at now (2.2 = the starting level). */
  level: number | null
  strengths: FamilyStat[]
  focus: FamilyStat[]
  kinds: { label: string; attempts: number; rate: number }[]
  mistakes: { label: string; meaning: string; count: number }[]
  /** Mystery words: never taught, only met after the family's taught words. */
  newWords: { tried: number; clean: number }
  /** How often she asked the Judge something before spelling. */
  asked: { times: number; of: number }
  stage: { asked: number; correct: number }
  recommendations: string[]
}

export const KIND_LABELS: Record<string, string> = {
  'vowel-teams': 'Vowel teams (ai, ee, oa…)',
  endings: 'Word endings (-tion, -ous, -able…)',
  'joining-rules': 'Joining rules (doubling, dropping E, plurals)',
  'silent-letters': 'Silent letters',
  origins: 'Words from other languages',
  'consonant-choices': 'Consonant choices (ck, tch, soft c and g)',
  'bossy-r': 'Vowels with R (ar, or, er)',
  'tricky-vowels': 'Tricky vowels (ie/ei, ough, the quiet vowel)',
  'magic-e': 'Magic E',
  prefixes: 'Word beginnings (un-, dis-, mis-)',
  'sound-alikes': 'Sound-alike words',
}

const MISTAKES: Record<string, [string, string]> = {
  PHONETIC_PATTERN_ERROR: ['Sounds right, spelled wrong', 'She hears the word correctly but picks the wrong spelling for a sound. This is the kind the word families teach.'],
  AFFIX_JUNCTION_ERROR: ['Joining slip', 'The base word is right, but the join went wrong: a missed double letter, a kept E, or a Y that should be I.'],
  SYLLABLE_OMISSION: ['Dropped a beat', 'A quiet part of the word was left out. Saying the word slowly, beat by beat, helps.'],
  MOTOR_SLIP: ['Slip of the hand', 'Letters swapped or one stray letter. She knows the word; this is about checking before pressing Done.'],
  UK_US_VARIANT_TRAP: ['British spelling', 'A correct British spelling of a word the app spells the American way.'],
}

const day = (t: number) => new Date(t).toDateString()
const rate = (list: Attempt[]) => (list.length ? list.filter((a) => a.r === 'CLEAN').length / list.length : 0)

export function buildInsights(progress: Progress): Insights {
  const history = [...(progress.history ?? [])].filter((a) => getWord(a.w)).sort((a, b) => a.t - b.t)
  const learning = history.filter((a) => a.how !== 'STAGE')
  const stage = history.filter((a) => a.how === 'STAGE')
  const enough = history.length >= 10

  // Per family, over its last 10 attempts (the same window the spec uses to call a pattern weak).
  const byFamily = new Map<string, Attempt[]>()
  for (const a of history) {
    const id = getWord(a.w)!.patternId
    byFamily.set(id, [...(byFamily.get(id) ?? []), a])
  }
  const stats: FamilyStat[] = []
  for (const [patternId, all] of byFamily) {
    const recent = all.slice(-10)
    const p = getPattern(patternId)!
    const struggled = [...new Set(recent.filter((a) => a.r !== 'CLEAN').map((a) => getWord(a.w)!.word).reverse())]
    stats.push({
      patternId,
      title: p.title,
      secret: p.secret ?? p.kidRule,
      attempts: recent.length,
      clean: recent.filter((a) => a.r === 'CLEAN').length,
      rate: rate(recent),
      struggled,
    })
  }
  const strengths = stats.filter((s) => s.attempts >= 3 && s.rate >= 0.8).sort((a, b) => b.rate - a.rate || b.attempts - a.attempts)
  // A family needs work only when two or more different words went wrong, never on one miss.
  const focus = stats.filter((s) => s.struggled.length >= 2).sort((a, b) => a.rate - b.rate || b.struggled.length - a.struggled.length)

  const byKind = new Map<string, Attempt[]>()
  for (const a of history) {
    const kind = getPattern(getWord(a.w)!.patternId)?.kind ?? 'other'
    byKind.set(kind, [...(byKind.get(kind) ?? []), a])
  }
  const kinds = [...byKind.entries()]
    .map(([kind, list]) => ({ label: KIND_LABELS[kind] ?? kind, attempts: list.length, rate: rate(list) }))
    .sort((a, b) => b.attempts - a.attempts)

  const counts = new Map<string, number>()
  for (const a of history) if (a.b && MISTAKES[a.b]) counts.set(a.b, (counts.get(a.b) ?? 0) + 1)
  const mistakes = [...counts.entries()]
    .map(([b, count]) => ({ label: MISTAKES[b][0], meaning: MISTAKES[b][1], count }))
    .sort((a, b) => b.count - a.count)

  const probes = history.filter((a) => getWord(a.w)!.role === 'TRANSFER_PROBE')
  const recent = learning.slice(-15)
  const insights: Insights = {
    enough,
    attempts: history.length,
    daysPlayed: new Set(history.map((a) => day(a.t))).size,
    wordsSolved: Object.keys(progress.solved).length,
    cleanRate: learning.length ? rate(learning) : null,
    recentRate: recent.length >= 5 ? rate(recent) : null,
    level: history.length ? calibrationFor(progress).target : null,
    strengths,
    focus,
    kinds,
    mistakes,
    newWords: { tried: probes.length, clean: probes.filter((a) => a.r === 'CLEAN').length },
    asked: { times: history.filter((a) => (a.asks ?? 0) > 0).length, of: history.length },
    stage: { asked: stage.length, correct: stage.filter((a) => a.r === 'CLEAN').length },
    recommendations: [],
  }
  insights.recommendations = recommend(insights)
  return insights
}

const pct = (x: number) => `${Math.round(x * 100)}%`

function recommend(i: Insights): string[] {
  if (!i.enough) {
    return [`There is not enough to go on yet (${i.attempts} of about 10 words). Suggestions appear once she has played a little more.`]
  }
  const out: string[] = []

  if (i.recentRate !== null) {
    if (i.recentRate >= 0.85) {
      out.push(`She is getting ${pct(i.recentRate)} of recent words right first time, which is above the 75–85% sweet spot. The words are a little easy for her; she is ready for harder ones.`)
    } else if (i.recentRate >= 0.75) {
      out.push(`She is getting ${pct(i.recentRate)} of recent words right first time. That is the sweet spot (75–85%): hard enough to learn from, easy enough to enjoy.`)
    } else if (i.recentRate >= 0.65) {
      out.push(`She is getting ${pct(i.recentRate)} of recent words right first time, a little under the sweet spot. That is fine for a while; encourage her to use the Ask button before she answers.`)
    } else {
      out.push(`She is getting ${pct(i.recentRate)} of recent words right first time. The words are a stretch at the moment. Sitting with her for a few sessions, and using Help together, will do more than extra practice alone.`)
    }
  }

  for (const f of i.focus.slice(0, 2)) {
    out.push(`Work on “${f.title}”. She has tripped on ${f.struggled.slice(0, 4).join(', ')}. The idea to talk about: ${f.secret} Try writing those words on paper and asking her to point to the tricky part.`)
  }
  if (i.focus.length === 0 && i.strengths.length > 0) {
    out.push('No word family stands out as a problem. One miss in a family is not counted as a weakness; two different words are.')
  }

  const top = i.mistakes[0]
  if (top && top.count >= 3) {
    if (top.label === 'Slip of the hand') out.push('Most of her mistakes are slips, not gaps in knowledge. Ask her to read her letters back, pointing at each tile, before she presses Done.')
    if (top.label === 'Dropped a beat') out.push('She often leaves out a quiet part of the word. Clap the beats together, and use “Say it slowly” before spelling.')
    if (top.label === 'Joining slip') out.push('Her mistakes are mostly at the join between a word and its ending. Practise pairs out loud: hop, hopping; hope, hoping; happy, happiness.')
    if (top.label === 'Sounds right, spelled wrong') out.push('Her mistakes mostly sound right but use the wrong spelling for a sound. That is normal at this stage, and it is what the word families are for; the “secret” after each word is worth saying aloud together.')
  }

  if (i.newWords.tried >= 3) {
    const r = i.newWords.clean / i.newWords.tried
    out.push(
      r >= 0.6
        ? `She got ${i.newWords.clean} of ${i.newWords.tried} mystery words right first time. These are words she was never taught, so she is applying the rules, not only remembering words.`
        : `She got ${i.newWords.clean} of ${i.newWords.tried} mystery words right first time. She knows the words she has practised but does not yet carry the rule over to new ones. When a word is done, ask her for another word with the same secret.`,
    )
  }

  if (i.asked.of >= 15 && i.asked.times / i.asked.of < 0.1) {
    out.push('She rarely asks the Judge anything before spelling. Real bee spellers always ask for the meaning and a sentence; it is free here, and it is how words stick.')
  } else if (i.asked.of >= 15 && i.asked.times / i.asked.of >= 0.4) {
    out.push(`She asked the Judge a question on ${i.asked.times} of ${i.asked.of} words. That curiosity about meaning is a very good sign.`)
  }

  if (i.stage.asked >= 8 && i.cleanRate !== null) {
    const s = i.stage.correct / i.stage.asked
    if (s + 0.25 < i.cleanRate) out.push(`On the bee stage she gets ${pct(s)} right, well below her ${pct(i.cleanRate)} in puzzles. Spelling a whole word from nothing is harder than filling a gap; more stage rounds will close that.`)
  }
  return out
}

/** Every family has a parent-facing kind label. */
export const unlabelledKinds = () => [...new Set(PATTERNS.map((p) => p.kind ?? ''))].filter((k) => !KIND_LABELS[k])
