import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
  undo?: () => void | Promise<void>
  /** etykieta przycisku akcji (domyślnie „Cofnij”) */
  actionLabel?: string
  tone?: 'default' | 'success' | 'info'
  /** ms */
  duration?: number
}

export interface FocusSession {
  taskId: string | null
  title: string
  minutes: number
  /** „Tylko 5 minut” — po końcu pytamy, czy dalej, bez presji */
  starter: boolean
}

interface UIState {
  toasts: Toast[]
  dumpOpen: boolean
  taskId: string | null
  focus: FocusSession | null
  /** pokazuje „+10 XP” przy liczniku */
  xpPulse: { id: number; amount: number } | null
  levelUp: number | null
}

let state: UIState = { toasts: [], dumpOpen: false, taskId: null, focus: null, xpPulse: null, levelUp: null }
const listeners = new Set<() => void>()

function set(patch: Partial<UIState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useUI<T>(sel: (s: UIState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => sel(state),
  )
}

let toastSeq = 1
export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) {
  const t: Toast = { id: toastSeq++, text, duration: opts.undo ? 6000 : 3000, ...opts }
  // Maks. 2 naraz — bez zalewania ekranu.
  set({ toasts: [...state.toasts.slice(-1), t] })
  setTimeout(() => dismissToast(t.id), t.duration)
  return t.id
}

export function dismissToast(id: number) {
  if (!state.toasts.some((t) => t.id === id)) return
  set({ toasts: state.toasts.filter((t) => t.id !== id) })
}

export const openDump = () => set({ dumpOpen: true })
export const closeDump = () => set({ dumpOpen: false })
export const openTask = (id: string | null) => set({ taskId: id })
export const startFocus = (f: FocusSession) => set({ focus: f })
export const endFocus = () => set({ focus: null })
export const pulseXp = (amount: number) => set({ xpPulse: { id: Date.now(), amount } })
export const showLevelUp = (level: number | null) => set({ levelUp: level })
export const getUI = () => state
