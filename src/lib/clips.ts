/**
 * Recorded voice. The site build may include recordings under audio/ (made by
 * scripts/generate_audio.py, keys listed in audio/index.json). When a recording
 * exists it is played; otherwise the caller falls back to the device's voice.
 * Keys must match scripts/audio-manifest.mjs.
 */
export const clipKeys = {
  word: (word: string) => `w/${word}`,
  slowWord: (word: string) => `s/${word}`,
  sentence: (word: string, meaning: number) => `x/${word}-${meaning}`,
  definition: (word: string, meaning: number) => `d/${word}-${meaning}`,
  secret: (word: string) => `q/${word}`,
  card: (word: string) => `c/${word}`,
  greatDetective: 'p/great-detective',
  notQuite: 'p/not-quite',
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

export function stopClip() {
  playing++
  player?.pause()
}

/**
 * Plays a recording. Resolves true if it started, false if the caller should
 * fall back to the device voice. Fetched as a whole file so the service worker
 * can cache it for offline use.
 */
export async function playClip(key: string): Promise<boolean> {
  const p = getPlayer()
  if (!p || !hasClip(key)) return false
  const ticket = ++playing
  try {
    const r = await fetch(`${base()}${key}.mp3`)
    if (!r.ok) return false
    const url = URL.createObjectURL(await r.blob())
    if (ticket !== playing) return true // something newer was asked for meanwhile
    p.pause()
    p.src = url
    p.onended = () => URL.revokeObjectURL(url)
    await p.play()
    return true
  } catch {
    return false
  }
}
