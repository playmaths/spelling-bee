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

/** What the recorded voice is doing, for the "Voice check" on the grown-ups screen. */
export const voiceStatus = {
  /** How many recordings the site offers; null while loading or if the list could not be read. */
  recordings: null as number | null,
  listError: null as string | null,
  /** Whether a tap has given this page permission to play sound. */
  unlocked: false,
  /** Why the last attempt to play a recording failed, if it did. */
  lastError: null as string | null,
  lastUsed: null as 'RECORDED' | 'DEVICE' | null,
}

/** A real (if silent) tenth of a second of audio: an empty file does not count as playing on phones. */
function silentWav(): string {
  const rate = 8000
  const samples = rate / 10
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const text = (at: number, t: string) => [...t].forEach((ch, k) => v.setUint8(at + k, ch.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

function getPlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!player) {
    player = new Audio()
    player.preload = 'auto'
    player.setAttribute('playsinline', '')
  }
  return player
}

const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const

/**
 * Phones only let a page play sound once the person has tapped, and then only on
 * an audio player that was started inside a tap. So the first taps play a moment of
 * silence on the one shared player; after that it may play recordings at any time.
 * It keeps trying on each tap until one succeeds.
 */
function unlock() {
  const p = getPlayer()
  if (!p || unlocked || unlocking) return
  unlocking = true
  p.src = silentWav()
  p.play()
    .then(() => {
      unlocked = true
      voiceStatus.unlocked = true
      GESTURES.forEach((g) => window.removeEventListener(g, unlock, true))
    })
    .catch((e: unknown) => {
      voiceStatus.lastError = `could not start sound: ${(e as Error)?.name ?? e}`
    })
    .finally(() => {
      unlocking = false
    })
}
let unlocking = false

/** Call once at start-up. Safe anywhere: with no recordings the app simply uses the device voice. */
export function initClips() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || !/^https?:$/.test(location.protocol)) return
  loadClipList()
  GESTURES.forEach((g) => window.addEventListener(g, unlock, true))
}

/** Reads which recordings exist. Tried again by the voice check if it failed (for example, offline at start-up). */
export function loadClipList(): Promise<void> {
  return fetch(`${base()}index.json`, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((keys: unknown) => {
      if (!Array.isArray(keys)) throw new Error('unexpected list')
      available = new Set(keys as string[])
      voiceStatus.recordings = available.size
      voiceStatus.listError = null
    })
    .catch((e: unknown) => {
      voiceStatus.listError = String((e as Error)?.message ?? e)
    })
}

export const hasClip = (key: string | undefined): key is string => !!key && !!available?.has(key)
export const hasClips = (keys: readonly string[] | undefined): keys is readonly string[] =>
  !!keys && keys.length > 0 && keys.every((k) => available?.has(k))

export function stopClip() {
  playing++
  player?.pause()
}

const isLetter = (key: string) => key.startsWith('l/')

/** Milliseconds of quiet between two clips played in a row. */
export function pauseBefore(previous: string, upcoming: string): number {
  if (isLetter(previous) && isLetter(upcoming)) return 380
  if (isLetter(upcoming) || isLetter(previous)) return 300
  return 180
}

interface Run {
  ticket: number
  keys: string[]
  /** One pending download per clip; null if that clip could not be fetched. */
  urls: Promise<string | null>[]
  i: number
  done: boolean
}
let run: Run | null = null

const load = (key: string): Promise<string | null> =>
  fetch(`${base()}${key}.mp3`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(key))))
    .then((b) => URL.createObjectURL(b))
    .catch(() => null)

/**
 * Plays recordings one after another. Resolves true if playback started, false if
 * the caller should fall back to the device voice. Files are fetched whole (in
 * parallel) so the service worker can cache them for offline use.
 */
export async function playClips(keys: readonly string[]): Promise<boolean> {
  const p = getPlayer()
  if (!p || !hasClips(keys)) return false
  const ticket = ++playing
  const r: Run = { ticket, keys: [...keys], urls: keys.map(load), i: 0, done: false }
  run = r
  if ((await r.urls[0]) === null) {
    r.done = true
    voiceStatus.lastError = `could not download ${keys[0]}`
    return false
  }
  if (ticket !== playing) return true // something newer was asked for meanwhile
  const step = async (): Promise<void> => {
    if (ticket !== playing || r.i >= r.urls.length) {
      r.done = true
      return
    }
    const url = await r.urls[r.i++]
    if (ticket !== playing) return
    if (!url) return step()
    p.src = url
    p.play().catch(() => {
      r.done = true
    })
  }
  // Leave a breath between pieces so a stitched line is not rushed, and a longer
  // one between letter names, the way a bee judge spells a word out.
  p.onended = () => {
    if (r.i >= r.urls.length) {
      r.done = true
      return
    }
    window.setTimeout(() => void step(), pauseBefore(r.keys[r.i - 1], r.keys[r.i]))
  }
  // Start the first clip here, so that if the phone refuses to play it the caller
  // hears about it and can use the device voice instead of leaving her in silence.
  try {
    p.pause()
    p.src = (await r.urls[0]) as string
    r.i = 1
    await p.play()
    voiceStatus.lastError = null
  } catch (e: unknown) {
    if (ticket !== playing) return true
    r.done = true
    voiceStatus.lastError = `the phone refused to play it: ${(e as Error)?.name ?? e}`
    return false
  }
  return true
}

/**
 * Adds more recordings to the end of whatever is being said now (the Judge's
 * verdict, then the praise). Returns false if nothing is playing, so the caller
 * can simply say it straight away.
 */
export function appendClips(keys: readonly string[]): boolean {
  if (!run || run.done || run.ticket !== playing || !hasClips(keys)) return false
  run.keys.push(...keys)
  run.urls.push(...keys.map(load))
  return true
}
