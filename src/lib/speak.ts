/**
 * Browser text-to-speech. Picks the most natural English voice the device has;
 * silently does nothing where speech is unavailable.
 */

import { hasClips, playClips, stopClip } from './clips.ts'

const VOICE_KEY = 'spelling-bee-voice'
let muted = false

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

/** Higher is better. Neural/enhanced voices sound far less robotic than the compact defaults. */
export function scoreVoice(v: { name: string; lang: string; localService?: boolean }): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  if (!lang.startsWith('en')) return -1
  let score = lang === 'en-us' ? 3 : lang === 'en-gb' ? 2 : 1
  if (/natural|neural|enhanced|premium|siri/i.test(v.name)) score += 6
  if (/online/i.test(v.name)) score += 2
  if (/google (us|uk) english/i.test(v.name)) score += 4
  if (/\b(samantha|ava|allison|zoe|aria|jenny|sonia|libby|karen|moira|serena)\b/i.test(v.name)) score += 3
  if (/\b(zira|hazel|susan)\b/i.test(v.name)) score += 1
  if (/\b(david|mark|george)\b/i.test(v.name)) score -= 1
  if (/compact|espeak|robot|albert|bad news|bells|boing|bubbles|cellos|jester|organ|whisper|zarvox|trinoids|wobble|fred|ralph|junior/i.test(v.name)) score -= 6
  return score
}

export function listVoices(): SpeechSynthesisVoice[] {
  return (synth()?.getVoices() ?? [])
    .filter((v) => scoreVoice(v) >= 0)
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

export function getVoiceName(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY)
  } catch {
    return null
  }
}

export function setVoiceName(name: string) {
  try {
    localStorage.setItem(VOICE_KEY, name)
  } catch {
    // ignore
  }
}

export function setMuted(value: boolean) {
  muted = value
  if (value) {
    synth()?.cancel()
    stopClip()
  }
}

function speakWithDevice(text: string, slow: boolean) {
  const s = synth()
  if (!s) return
  const clean = text.replace(/\*/g, '').replace(/\p{Extended_Pictographic}/gu, '')
  const utterance = new SpeechSynthesisUtterance(clean)
  const voices = listVoices()
  const voice = voices.find((v) => v.name === getVoiceName()) ?? voices[0]
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'en-US'
  }
  utterance.rate = slow ? 0.55 : 0.88
  s.cancel()
  s.speak(utterance)
}

/**
 * Says something. If recordings exist for every clip they are played in order;
 * otherwise (or if they cannot be played) the device's own voice reads `text`.
 */
export function speak(text: string, slow = false, clip?: string | readonly string[]) {
  if (muted) return
  synth()?.cancel()
  stopClip()
  const clips = typeof clip === 'string' ? [clip] : clip
  if (hasClips(clips)) {
    void playClips(clips).then((ok) => {
      if (!ok && !muted) speakWithDevice(text, slow)
    })
    return
  }
  speakWithDevice(text, slow)
}
