import confetti from 'canvas-confetti'
import { getSettings } from './settings'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.12) {
  const a = audio()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, a.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.05)
}

export type Sound = 'done' | 'step' | 'dump' | 'timer' | 'level'

export function playSound(kind: Sound) {
  if (!getSettings().sound) return
  switch (kind) {
    case 'done':
      tone(659.25, 0, 0.25)
      tone(783.99, 0.09, 0.25)
      tone(1046.5, 0.18, 0.45)
      break
    case 'step':
      tone(880, 0, 0.18, 0.08)
      break
    case 'dump':
      tone(523.25, 0, 0.12, 0.06)
      tone(659.25, 0.06, 0.16, 0.06)
      break
    case 'timer':
      tone(523.25, 0, 0.6, 0.1)
      tone(659.25, 0.35, 0.6, 0.1)
      tone(783.99, 0.7, 0.9, 0.1)
      break
    case 'level':
      ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.1, 0.4, 0.09))
      break
  }
}

const COLORS = ['#7fb69a', '#f2c879', '#b8a4e3', '#f4a38c', '#8cc7e8']

export function celebrate(origin?: { x: number; y: number }, big = false) {
  const s = getSettings()
  if (!s.confetti || s.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  void confetti({
    particleCount: big ? 160 : 70,
    spread: big ? 100 : 65,
    startVelocity: big ? 45 : 32,
    origin: origin ?? { x: 0.5, y: 0.7 },
    colors: COLORS,
    scalar: 0.9,
    ticks: 160,
    disableForReducedMotion: true,
  })
}

export function vibrate(ms = 15) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* brak wsparcia */
  }
}
