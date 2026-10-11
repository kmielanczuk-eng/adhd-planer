import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  sound: boolean
  confetti: boolean
  aiKey: string
  /** limit „na dziś” — miękki, można przekroczyć */
  dailyLimit: number
  focusMinutes: number
  localNotifications: boolean
  /** dni oznaczone jako wolne (urlop, choroba) — nie przerywają serii */
  restDays: string[]
  name: string
  seenIosHint: boolean
  reduceMotion: boolean
}

const KEY = 'ogarniacz:settings'

const DEFAULTS: Settings = {
  theme: 'system',
  sound: true,
  confetti: true,
  aiKey: '',
  dailyLimit: 3,
  focusMinutes: 15,
  localNotifications: true,
  restDays: [],
  name: '',
  seenIosHint: false,
  reduceMotion: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* prywatne okno / brak dostępu — działamy na domyślnych */
  }
  return { ...DEFAULTS }
}

let current: Settings = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* ignoruj */
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', dark ? '#1b1f1d' : '#f6f4ef')
}
