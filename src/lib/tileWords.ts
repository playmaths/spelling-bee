import { WORDS } from '../data/index.ts'
import tileWords from '../data/tileWords.json'
import { makeDictionary, SIZE } from '../engine/tileGame.ts'

/**
 * The tile game's word book: everyday words (scripts/build-tile-words.mjs) plus
 * every spelling-bank word short enough to fit the board. Bank words she has not
 * met are allowed too; a child may know a word before the app teaches it.
 */
const BANK = WORDS.map((w) => w.word).filter((w) => w.length <= SIZE)
export const TILE_DICTIONARY = makeDictionary((tileWords as string).split(' '), BANK)
