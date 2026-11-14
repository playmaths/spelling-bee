/**
 * Recorded voice. The site build may include recordings under audio/ (made by
 * scripts/generate_audio.py, keys listed in audio/index.json). When a recording
 * exists it is played; otherwise the caller falls back to the device's voice.
 * Keys come from src/engine/voice.ts; the list to record from src/lib/voiceManifest.ts.
 */
import {
  cardClip,
  definitionClip,
  phrase,
  sayText,
  secretClip,
  sentenceClip,
  slowWordClip,
  wordClip,
} from '../engine/voice.ts'

export const clipKeys = {
  word: wordClip,
  slowWord: slowWordClip,
  sentence: sentenceClip,
  definition: definitionClip,
  secret: secretClip,
  card: cardClip,
  text: sayText,
  greatDetective: phrase('greatDetective'),
  notQuite: phrase('notQuite'),
}

const base = () => `${import.meta.env.BASE_URL}audio/`
let available: Set<string> | null = null
let player: HTMLAudioElement | null = null
let unlocked = false
let playing = 0

// A tiny silent WAV, played inside the first tap so iOS lets later clips play.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

function getPlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!player) player = new Audio()
  return player
}

/** Call once at start-up. Safe anywhere: with no recordings the app simply uses the device voice. */
export function initClips() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || !/^https?:$/.test(location.protocol)) return
  fetch(`${base()}index.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((keys: unknown) => {
      if (Array.isArray(keys)) available = new Set(keys as string[])
    })
    .catch(() => {})
  const unlock = () => {
    const p = getPlayer()
    if (!p || unlocked) return
    unlocked = true
    p.src = SILENCE
    p.play().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}

export const hasClip = (key: string | undefined): key is string => !!key && !!available?.has(key)
export const hasClips = (keys: readonly string[] | undefined): keys is readonly string[] =>
  !!keys && keys.length > 0 && keys.every((k) => available?.has(k))

export function stopClip() {
  playing++
  player?.pause()
}

/**
 * Plays recordings one after another. Resolves true if playback started, false if
 * the caller should fall back to the device voice. Files are fetched whole (in
 * parallel) so the service worker can cache them for offline use.
 */
const isLetter = (key: string) => key.startsWith('l/')

/** Milliseconds of quiet between two clips played in a row. */
export function pauseBefore(previous: string, upcoming: string): number {
  if (isLetter(previous) && isLetter(upcoming)) return 380
  if (isLetter(upcoming) || isLetter(previous)) return 300
  return 180
}

export async function playClips(keys: readonly string[]): Promise<boolean> {
  const p = getPlayer()
  if (!p || !hasClips(keys)) return false
  const ticket = ++playing
  try {
    const blobs = await Promise.all(
      keys.map(async (key) => {
        const r = await fetch(`${base()}${key}.mp3`)
        if (!r.ok) throw new Error(key)
        return r.blob()
      }),
    )
    if (ticket !== playing) return true // something newer was asked for meanwhile
    const urls = blobs.map((b) => URL.createObjectURL(b))
    const done = () => urls.forEach((u) => URL.revokeObjectURL(u))
    let i = 0
    const next = () => {
      if (ticket !== playing || i >= urls.length) return done()
      p.src = urls[i++]
      p.play().catch(done)
    }
    // Leave a breath between pieces so a stitched line is not rushed, and a longer
    // one between letter names, the way a bee judge spells a word out.
    p.onended = () => {
      if (i >= urls.length) return done()
      window.setTimeout(next, pauseBefore(keys[i - 1], keys[i]))
    }
    p.pause()
    next()
    return true
  } catch {
    return false
  }
}
