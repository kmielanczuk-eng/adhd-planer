import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase, redirectUrl } from './supabase'
import { SyncEngine, collectDirty, type SyncStatus } from './sync'
import { db } from './db'
import { ensureDopamineDefaults } from './actions'

interface AccountState {
  user: User | null
  ready: boolean
  sync: SyncStatus
}

let state: AccountState = { user: null, ready: false, sync: { state: 'off', lastSync: null } }
const listeners = new Set<() => void>()
function set(p: Partial<AccountState>) {
  state = { ...state, ...p }
  listeners.forEach((l) => l())
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

let engine: SyncEngine | null = null

export function initAccount() {
  const sb = getSupabase()
  if (!sb) {
    set({ ready: true })
    return
  }
  engine = new SyncEngine(sb)
  engine.subscribe((s) => set({ sync: s }))
  const apply = (user: User | null) => {
    const prev = state.user?.id
    set({ user, ready: true })
    if (user && user.id !== prev) engine!.start(user.id)
    if (!user && prev) engine!.stop()
  }
  sb.auth.getSession().then(({ data }) => apply(data.session?.user ?? null))
  sb.auth.onAuthStateChange((_e, session) => {
    // Supabase zaleca nie wołać innych metod klienta synchronicznie w tym callbacku.
    setTimeout(() => apply(session?.user ?? null), 0)
  })
  // Po powrocie z linku (?code=…) wyczyść URL, zostawiając hash z trasą.
  if (location.search.includes('code=')) {
    setTimeout(() => history.replaceState(null, '', location.pathname + location.hash), 1500)
  }
}

export function syncNow() {
  engine?.schedule(0)
}

export async function sendMagicLink(email: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana.')
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function verifyCode(email: string, token: string) {
  const sb = getSupabase()
  if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana.')
  const { error } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' })
  if (error) throw new Error(translateAuthError(error.message))
}

/**
 * Wylogowanie: najpierw dosyłamy niewysłane zmiany, wyłączamy push na tym urządzeniu,
 * potem czyścimy lokalne dane — żeby kolejna osoba na tym urządzeniu nie widziała cudzych zadań.
 * Zwraca false (i nic nie usuwa), gdy są niewysłane zmiany, a serwer jest nieosiągalny.
 */
export async function signOut(force = false): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return true
  if (engine && state.user) {
    await engine.run()
    const pending = await collectDirty()
    if (pending.length && !force) return false
  }
  try {
    const { disablePush } = await import('./notify')
    await disablePush()
  } catch {
    /* brak push — ok */
  }
  await sb.auth.signOut()
  await db.transaction('rw', [db.tasks, db.notes, db.xp, db.dopamine, db.meta], async () => {
    await Promise.all([db.tasks.clear(), db.notes.clear(), db.xp.clear(), db.dopamine.clear(), db.meta.clear()])
  })
  await ensureDopamineDefaults()
  return true
}

function translateAuthError(msg: string): string {
  if (/rate limit|security purposes|too many/i.test(msg)) return 'Za dużo prób. Odczekaj chwilę (limit wysyłki maili) i spróbuj ponownie.'
  if (/invalid|expired/i.test(msg)) return 'Kod jest nieprawidłowy albo wygasł. Wyślij nowy link.'
  if (/fetch|network/i.test(msg)) return 'Brak połączenia z internetem.'
  return msg
}
