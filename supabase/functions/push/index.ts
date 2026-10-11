// Funkcja Edge „push” — Web Push dla Ogarniacza.
//   GET  ?action=vapid  → publiczny klucz VAPID (generowany przy pierwszym wywołaniu)
//   POST ?action=cron   → wysyła przypomnienia, którym minął czas (wywołuje pg_cron co minutę; nagłówek x-cron-secret)
//   POST ?action=test   → testowe powiadomienie na urządzenia zalogowanego użytkownika (nagłówek Authorization: Bearer <token>)
// Wdrażana z verify_jwt = false — uwierzytelnianie robimy sami (patrz DECISIONS.md, pkt 11).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })
}

const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

async function getSecret(key: string): Promise<string | null> {
  const { data } = await admin.from('app_secrets').select('value').eq('key', key).maybeSingle()
  return (data?.value as string | undefined) ?? null
}

let appServerPromise: Promise<{ server: webpush.ApplicationServer; publicKey: string }> | null = null

async function loadAppServer() {
  let raw = await getSecret('vapid_keys')
  if (!raw) {
    const keys = await webpush.generateVapidKeys({ extractable: true })
    const exported = await webpush.exportVapidKeys(keys)
    // ignoreDuplicates: gdy dwa wywołania wygenerują klucze naraz, zostaje pierwszy zapis
    await admin.from('app_secrets').upsert({ key: 'vapid_keys', value: JSON.stringify(exported) }, { onConflict: 'key', ignoreDuplicates: true })
    raw = await getSecret('vapid_keys')
  }
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(raw!), { extractable: true })
  const publicKey = await webpush.exportApplicationServerKey(vapidKeys)
  const contact = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ogarniacz@example.com'
  const server = await webpush.ApplicationServer.new({ contactInformation: contact, vapidKeys })
  return { server, publicKey }
}

function appServer() {
  if (!appServerPromise) appServerPromise = loadAppServer().catch((e) => {
    appServerPromise = null
    throw e
  })
  return appServerPromise
}

interface SubRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function sendTo(subs: SubRow[], payload: Record<string, unknown>) {
  const { server } = await appServer()
  let sent = 0
  const gone: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        const subscriber = server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        await subscriber.pushTextMessage(JSON.stringify(payload), { ttl: 6 * 3600, urgency: webpush.Urgency.High })
        sent++
      } catch (e) {
        if (e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)) gone.push(s.id)
        else console.error('push error', s.endpoint.slice(0, 60), String(e))
      }
    }),
  )
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone)
  return sent
}

async function runCron() {
  const { data: due, error } = await admin.rpc('due_reminders', { max_rows: 200 })
  if (error) throw error
  let sent = 0
  for (const row of (due ?? []) as Array<{ user_id: string; id: string; title: string | null; remind_at: string }>) {
    // „Zaklepujemy” wysyłkę — klucz główny (record_id, remind_at) chroni przed podwójnym wysłaniem przy nakładających się wywołaniach.
    const { error: claimErr } = await admin.from('reminders_sent').insert({ user_id: row.user_id, record_id: row.id, remind_at: row.remind_at })
    if (claimErr) continue
    const { data: subs } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', row.user_id)
    const n = subs?.length
      ? await sendTo(subs as SubRow[], {
          title: '🔔 ' + (row.title || 'Zadanie'),
          body: 'Masz chwilę? Wystarczy zacząć — nawet na 5 minut.',
          taskId: row.id,
          tag: `task-${row.id}`,
        })
      : 0
    if (n === 0) {
      // Nie udało się (albo brak urządzeń) — zwalniamy blokadę, spróbujemy w kolejnej minucie (przez max 6 h).
      await admin.from('reminders_sent').delete().eq('record_id', row.id).eq('remind_at', row.remind_at)
    }
    sent += n
  }
  return { due: due?.length ?? 0, sent }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const action = new URL(req.url).searchParams.get('action')
  try {
    if (action === 'vapid') {
      const { publicKey } = await appServer()
      return json({ publicKey })
    }

    if (action === 'cron') {
      const secret = await getSecret('cron_secret')
      if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
      return json(await runCron())
    }

    if (action === 'test') {
      const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (!token) return json({ error: 'Zaloguj się, żeby wysłać test.' }, 401)
      const { data: u, error } = await admin.auth.getUser(token)
      if (error || !u.user) return json({ error: 'Sesja wygasła — zaloguj się ponownie.' }, 401)
      const { data: subs } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', u.user.id)
      if (!subs?.length) return json({ error: 'Brak zarejestrowanych urządzeń.' }, 404)
      const sent = await sendTo(subs as SubRow[], { title: '👋 Test z Ogarniacza', body: 'Powiadomienia działają. Super!', tag: 'test' })
      return json({ sent })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
