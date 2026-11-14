import { isMuted } from './speak.ts'

/** Tiny synthesised chimes (no audio files): a rising run for a bloom, two soft notes for a sprout. */
let ctx: AudioContext | null = null

function tone(c: AudioContext, freq: number, at: number, length: number, gain: number) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + at)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + length)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime + at)
  osc.stop(c.currentTime + at + length + 0.05)
}

export function chime(kind: 'BLOOM' | 'GROW' | 'SPROUT') {
  if (isMuted() || typeof window === 'undefined') return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    const notes = kind === 'BLOOM' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'GROW' ? [523.25, 659.25, 783.99] : [392, 493.88]
    notes.forEach((f, i) => tone(ctx!, f, i * 0.11, kind === 'SPROUT' ? 0.5 : 0.4, 0.12))
  } catch {
    // Sound is a nicety; never let it break a celebration.
  }
}
