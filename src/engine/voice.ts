/**
 * The vocabulary of recorded speech. A spoken line is a sequence of clips:
 * fixed phrases, the word itself, letter names, and per-word or per-family texts.
 * Stitching keeps the number of recordings small (the Judge can say thousands of
 * different coaching lines) while everything stays in one voice.
 * Keys: w/ word, s/ slow word, x/ sentence, d/ meaning, q/ secret question,
 * c/ card sentence, l/ letter name, t/ any other text (keyed by a hash of the text).
 */
export function voiceHash(text: string): string {
  let x = 2166136261
  for (let i = 0; i < text.length; i++) {
    x ^= text.charCodeAt(i)
    x = Math.imul(x, 16777619) >>> 0
  }
  return x.toString(36)
}

/** The text as it is read aloud: no emphasis marks, no emoji. */
export function plainForVoice(text: string): string {
  return text.replace(/\*/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/️/g, '').trim()
}

export const sayText = (text: string) => `t/${voiceHash(plainForVoice(text))}`
export const wordClip = (word: string) => `w/${word}`
export const slowWordClip = (word: string) => `s/${word}`
export const sentenceClip = (word: string, meaning: number) => `x/${word}-${meaning}`
export const definitionClip = (word: string, meaning: number) => `d/${word}-${meaning}`
export const secretClip = (word: string) => `q/${word}`
export const cardClip = (word: string) => `c/${word}`
export const letterClip = (letter: string) => `l/${letter.toLowerCase()}`
export const spellClips = (letters: string) => [...letters].map(letterClip)

export const PHRASES = {
  nice: "Nice attempt! Let's check your spelling.",
  firstLetterOf: 'The first letter of',
  is: 'is',
  startsWith: 'starts with',
  butVowel: 'but listen to the next sound. Can you figure out which vowel comes next?',
  butLetter: 'but listen to the next sound. Can you figure out which letter comes next?',
  tooMany: 'but I think there are too many letters. Which one can go?',
  listenBeginning: 'Listen to the very beginning of',
  whichFirst: 'Can you figure out which letter comes first?',
  beatMissing: 'I think a beat went missing! Clap',
  correct: 'That is correct!',
  firstTry: 'You got it on the first try!',
  fixedIt: "That's it, you fixed it yourself!",
  isSpelled: 'is spelled',
  sorry: "I'm sorry, that is not the spelling we use in this bee.",
  twinSafe: 'That was the British spelling, so your streak is safe!',
  coachCorner: "We'll look at it together in Coach's Corner.",
  greatEffort: 'Great effort, this one is tricky!',
  meetAgain: "We'll meet it again soon.",
  twinAlert: 'British American Twin Alert!',
  clueTricky: "Here's a clue about the tricky part.",
  greatDetective: 'Great detective work!',
  notQuite: 'Not quite. Try another one.',
} as const

export const phrase = (name: keyof typeof PHRASES) => sayText(PHRASES[name])
export const beatsPhrase = (n: number) => `slowly. It has ${n} ${n === 1 ? 'beat' : 'beats'}. Which sound did we skip?`
export const boxPhrase = (n: number) => `So close! Take another look at box ${n}. I think your hand slipped there.`
export const MAX_BEATS = 8
export const MAX_BOXES = 20
