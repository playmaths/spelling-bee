import type { BeeWord } from '../types/game.ts'

/**
 * The phonics strip on a word card: the word split into letter chunks, with
 * blends (letters you hear one after another, said quickly: str, bl) and teams
 * (letters that work together for one sound: tch, igh, ai) marked.
 *
 * Chunks never cross a syllable break, so the S and H in MIS-HAP are not paired.
 * The family's own tricky part is always kept whole. This groups LETTERS; it makes
 * no claim about exactly which sound a team makes in a given word.
 */
export type ChunkKind = 'LETTER' | 'BLEND' | 'TEAM'
export interface Chunk {
  text: string
  kind: ChunkKind
  /** The tricky part this word's family is about. */
  focus: boolean
}

const TEAMS = [
  'eigh', 'ough', 'augh', 'tion', 'sion', 'ture',
  'igh', 'tch', 'dge', 'air', 'are', 'ear', 'ore', 'our', 'eer', 'ous',
  'ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng', 'qu', 'kn', 'wr', 'gn', 'mb', 'gh',
  'ai', 'ay', 'ee', 'ea', 'oa', 'ow', 'oo', 'ou', 'oi', 'oy', 'au', 'aw', 'ew', 'ue', 'ie', 'ei', 'ey',
  'ar', 'or', 'er', 'ir', 'ur', 'le',
]
const BLENDS = [
  'str', 'spr', 'scr', 'spl', 'squ', 'thr', 'shr',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw',
  'nd', 'nt', 'mp', 'nk', 'ft', 'lt', 'lk', 'ld',
]
const isVowel = (ch: string) => 'aeiouy'.includes(ch)

export function phonicsChunks(word: BeeWord): Chunk[] {
  const text = word.word
  const focus = word.graphemeMap.find((c) => c.isPatternFocus)
  const breaks = new Set<number>()
  let at = 0
  for (const s of word.syllables) breaks.add((at += s.length))

  const chunks: Chunk[] = []
  for (let i = 0; i < text.length; ) {
    if (focus && i === focus.startIndex) {
      const part = text.slice(focus.startIndex, focus.endIndex + 1)
      chunks.push({ text: part, kind: part.length > 1 ? 'TEAM' : 'LETTER', focus: true })
      i = focus.endIndex + 1
      continue
    }
    // How far this chunk may run: to the syllable break, and not into the tricky part.
    let limit = text.length
    for (const b of breaks) if (b > i && b < limit) limit = b
    if (focus && focus.startIndex > i && focus.startIndex < limit) limit = focus.startIndex
    const rest = text.slice(i, limit)
    const team = TEAMS.find((t) => rest.startsWith(t) && !(t === 'le' && i + 2 !== text.length))
    // A blend needs a vowel after it (or before it, for end blends), so two stray consonants are not paired.
    const blend = BLENDS.find((b) => rest.startsWith(b) && (isVowel(text[i + b.length] ?? '') || isVowel(text[i - 1] ?? '')))
    const pick = team && blend ? (team.length >= blend.length ? team : blend) : (team ?? blend)
    if (pick) {
      chunks.push({ text: pick, kind: pick === team ? 'TEAM' : 'BLEND', focus: false })
      i += pick.length
    } else {
      chunks.push({ text: text[i], kind: 'LETTER', focus: false })
      i += 1
    }
  }
  return chunks
}

/** One or two things to do with a pencil, drawn from the chunks. */
export function visualTips(chunks: Chunk[]): string[] {
  const tips: string[] = []
  const up = (c: Chunk) => c.text.toUpperCase().split('').join('-')
  const blend = chunks.find((c) => c.kind === 'BLEND')
  if (blend) tips.push(`Underline ${up(blend)}. You can hear each letter, said quickly together.`)
  const tricky = chunks.find((c) => c.focus && c.text.length > 1)
  const team = chunks.find((c) => c.kind === 'TEAM' && !c.focus)
  if (tricky) {
    const twins = tricky.text.length === 2 && tricky.text[0] === tricky.text[1]
    tips.push(
      twins
        ? `Circle the twin letters ${up(tricky)}.`
        : TEAMS.includes(tricky.text)
          ? `Circle ${up(tricky)}. These ${tricky.text.length} letters work as a team.`
          : `Circle ${up(tricky)}. That is the tricky part of this word.`,
    )
  } else if (team) {
    tips.push(`Circle ${up(team)}. These ${team.text.length} letters work as a team.`)
  }
  return tips
}
