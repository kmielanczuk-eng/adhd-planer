import { db } from './db'
import { getSettings } from './settings'
import { getSupabase } from './supabase'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import { toast } from './ui'

export const PUSH_FN = 'push'

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function pushSupported() {
  return notificationsSupported() && 'serviceWorker' in navigator && 'PushManager' in window
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export async function showLocalNotification(title: string, body: string, tag?: string, url?: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: import.meta.env.BASE_URL + 'icon-192.png',
        badge: import.meta.env.BASE_URL + 'badge-72.png',
        data: { url: url ?? import.meta.env.BASE_URL },
      })
      return true
    }
    new Notification(title, { body, tag })
    return true
  } catch {
    return false
  }
}

// ---------------- Lokalne przypomnienia (gdy apka otwarta) ----------------

const FIRED_KEY = 'ogarniacz:firedReminders'

function firedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveFired(s: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-300)))
  } catch {
    /* ignoruj */
  }
}

let checking = false
export async function checkLocalReminders() {
  if (!getSettings().localNotifications || checking) return
  checking = true
  try {
    await checkLocalRemindersInner()
  } finally {
    checking = false
  }
}

async function checkLocalRemindersInner() {
  const nowMs = Date.now()
  const fired = firedSet()
  const due = await db.tasks
    .filter((t) => !t.deleted && t.status !== 'done' && !!t.remindAt && new Date(t.remindAt).getTime() <= nowMs && nowMs - new Date(t.remindAt).getTime() < 6 * 3600_000)
    .toArray()
  for (const t of due) {
    const key = `${t.id}@${t.remindAt}`
    if (fired.has(key)) continue
    fired.add(key)
    toast(`🔔 ${t.title}`, { tone: 'info', duration: 10_000 })
    if (document.visibilityState !== 'visible') {
      await showLocalNotification('🔔 Przypomnienie', t.title, `task-${t.id}`, import.meta.env.BASE_URL + `#/teraz?task=${t.id}`)
    }
  }
  saveFired(fired)
}

let reminderTimer: ReturnType<typeof setInterval> | null = null
export function startLocalReminders() {
  if (reminderTimer) return
  void checkLocalReminders()
  reminderTimer = setInterval(() => void checkLocalReminders(), 20_000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkLocalReminders())
}

// ---------------- Web Push ----------------

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function fnFetch(path: string, init: RequestInit = {}) {
  const sb = getSupabase()
  const session = sb ? (await sb.auth.getSession()).data.session : null
  return fetch(`${SUPABASE_URL}/functions/v1/${PUSH_FN}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'content-type': 'application/json',
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
}

export async function getVapidKey(): Promise<string> {
  const r = await fnFetch('?action=vapid')
  if (!r.ok) throw new Error(`Serwer powiadomień nie odpowiada (${r.status}). Sprawdź RANO_ZROB_TO.md.`)
  const j = (await r.json()) as { publicKey?: string }
  if (!j.publicKey) throw new Error('Brak klucza VAPID na serwerze.')
  return j.publicKey
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error(isIOS() && !isStandalone() ? 'Na iPhonie najpierw dodaj apkę do ekranu głównego (Udostępnij → Do ekranu początkowego), potem otwórz ją z ikony.' : 'Ta przeglądarka nie obsługuje powiadomień push.')
  }
  const sb = getSupabase()
  const user = sb ? (await sb.auth.getUser()).data.user : null
  if (!sb || !user) throw new Error('Push wymaga zalogowania (Ustawienia → Konto i synchronizacja).')
  const perm = await requestPermission()
  if (perm !== 'granted') throw new Error('Powiadomienia są zablokowane w ustawieniach przeglądarki.')
  const key = await getVapidKey()
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    // Jeśli subskrypcja jest na inny klucz serwera — odnów.
    const existing = sub.options.applicationServerKey
    const want = b64ToUint8(key)
    const same = existing && new Uint8Array(existing).every((v, i) => v === want[i])
    if (!same) {
      await sub.unsubscribe()
      sub = null
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) as BufferSource })
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await sb.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200), tz_offset: new Date().getTimezoneOffset() },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error('Nie udało się zapisać subskrypcji: ' + error.message)
}

export async function disablePush() {
  const sub = await currentPushSubscription()
  if (!sub) return
  const sb = getSupabase()
  await sb?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush(): Promise<string> {
  const r = await fnFetch('?action=test', { method: 'POST', body: '{}' })
  const j = (await r.json().catch(() => ({}))) as { sent?: number; error?: string }
  if (!r.ok) throw new Error(j.error || `Błąd ${r.status}`)
  return `Wysłano na ${j.sent ?? 0} urządzeń.`
}
