import { sayText } from '../engine/voice.ts'

/**
 * What the Judge says when a word is finished. Praise is for what she DID
 * (listened, asked, checked, kept going), never for being clever, and a miss is
 * "not yet", never "wrong". Every line is fixed text so it can be recorded.
 */
export const PRAISE = {
  // right first time
  askedFirst: 'You asked first, like a real bee speller, and then got every letter.',
  mystery: 'You were never taught that word. You worked it out all by yourself!',
  comeback: "This one tricked you before, and now you've got it. That is how learning works!",
  pencil: 'You crossed out the letters that could not be right. That is smart thinking.',
  clean1: 'You listened carefully and got every letter.',
  clean2: 'First try, and all your own work.',
  clean3: 'You took your time, and it showed.',
  clean4: 'Every letter in its place. Lovely spelling.',
  // right after help or another try
  kept1: 'You kept going until it was right.',
  kept2: 'You stuck with it and finished. That takes courage.',
  kept3: 'You used a little help and finished the job.',
  // not solved this time
  close: 'You got the start exactly right. Only the sneaky part caught you.',
  notYet1: 'Not yet. This one needs a little more sun.',
  notYet2: "That was a tricky one. We'll meet it again.",
  notYet3: 'Good try. Tricky words are how spellers grow.',
} as const

export type PraiseKey = keyof typeof PRAISE

export interface Moment {
  /** How the word went. */
  r: 'CLEAN' | 'HELPED' | 'MISSED'
  /** She asked the Judge a question before answering. */
  asked?: boolean
  /** A mystery word she was never taught. */
  mystery?: boolean
  /** She had missed or needed help with this word before. */
  comeback?: boolean
  /** She crossed out candidates with the pencil. */
  pencil?: boolean
  /** A miss where at least the first half of the word was right. */
  close?: boolean
  /** Varies the everyday lines so she does not hear the same one each time. */
  seed: number
}

export function pickPraise(m: Moment): { key: PraiseKey; text: string; clip: string } {
  const rotate = (keys: PraiseKey[]) => keys[Math.abs(m.seed) % keys.length]
  let key: PraiseKey
  if (m.r === 'CLEAN') {
    // The rarest, most meaningful thing she did comes first.
    key = m.mystery ? 'mystery' : m.comeback ? 'comeback' : m.asked ? 'askedFirst' : m.pencil ? 'pencil' : rotate(['clean1', 'clean2', 'clean3', 'clean4'])
  } else if (m.r === 'HELPED') {
    key = rotate(['kept1', 'kept2', 'kept3'])
  } else {
    key = m.close ? 'close' : rotate(['notYet1', 'notYet2', 'notYet3'])
  }
  return { key, text: PRAISE[key], clip: sayText(PRAISE[key]) }
}
