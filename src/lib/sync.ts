import type { SupabaseClient } from '@supabase/supabase-js'
import { db, getMeta, observeTime, onLocalChange, setMeta, table } from './db'
import { SYNC_TABLES, type SyncFields, type TableName } from './types'

/** Wiersz w tabeli `records` w Supabase — jedna tabela na wszystkie typy (patrz DECISIONS.md). */
export interface RemoteRecord {
  tbl: TableName
  id: string
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
  server_updated_at?: string
}

type LocalRow = SyncFields & Record<string, unknown>

export function toRemote(tbl: TableName, row: LocalRow): RemoteRecord {
  const { dirty: _dirty, ...data } = row
  void _dirty
  return { tbl, id: row.id, data, updated_at: row.updatedAt, deleted: !!row.deleted }
}

export type MergeDecision = 'apply' | 'keep-local' | 'mark-clean'

/**
 * Last-write-wins na podstawie `updatedAt` (czas klienta w ms).
 * - brak lokalnego → bierzemy zdalny
 * - zdalny nowszy → bierzemy zdalny (nawet jeśli lokalny był „brudny” — przegrał)
 * - identyczny znacznik → nic nie zmieniamy, ale lokalny jest już zsynchronizowany
 * - lokalny nowszy → zostaje i zostanie wysłany
 */
export function mergeDecision(local: LocalRow | undefined, remote: RemoteRecord): MergeDecision {
  if (!local) return 'apply'
  if (remote.updated_at > local.updatedAt) return 'apply'
  if (remote.updated_at === local.updatedAt) return 'mark-clean'
  return 'keep-local'
}

export function fromRemote(remote: RemoteRecord): LocalRow {
  return {
    ...(remote.data as LocalRow),
    id: remote.id,
    updatedAt: remote.updated_at,
    deleted: remote.deleted ? 1 : 0,
    dirty: 0,
  }
}

/** Zastosuj paczkę zdalnych rekordów lokalnie. Zwraca liczbę zmienionych wierszy. */
export async function applyRemote(records: RemoteRecord[]): Promise<number> {
  let changed = 0
  const byTable = new Map<TableName, RemoteRecord[]>()
  for (const r of records) {
    observeTime(r.updated_at)
    if (!SYNC_TABLES.includes(r.tbl)) continue
    const arr = byTable.get(r.tbl) ?? []
    arr.push(r)
    byTable.set(r.tbl, arr)
  }
  for (const [tbl, recs] of byTable) {
    const t = table(tbl)
    await db.transaction('rw', t, async () => {
      const locals = await t.bulkGet(recs.map((r) => r.id))
      const puts: LocalRow[] = []
      for (let i = 0; i < recs.length; i++) {
        const local = locals[i]
        const decision = mergeDecision(local, recs[i])
        if (decision === 'apply') puts.push(fromRemote(recs[i]))
        else if (decision === 'mark-clean' && local?.dirty) puts.push({ ...local, dirty: 0 })
      }
      if (puts.length) {
        await t.bulkPut(puts)
        changed += puts.length
      }
    })
  }
  return changed
}

export async function collectDirty(): Promise<RemoteRecord[]> {
  const out: RemoteRecord[] = []
  for (const tbl of SYNC_TABLES) {
    const rows = await table(tbl).where('dirty').equals(1).toArray()
    rows.forEach((r) => out.push(toRemote(tbl, r)))
  }
  return out
}

/** Po udanym wysłaniu oznacz jako czyste — ale tylko jeśli w międzyczasie nikt ich nie zmienił. */
export async function markClean(sent: RemoteRecord[]) {
  for (const tbl of SYNC_TABLES) {
    const recs = sent.filter((r) => r.tbl === tbl)
    if (!recs.length) continue
    const t = table(tbl)
    await db.transaction('rw', t, async () => {
      const locals = await t.bulkGet(recs.map((r) => r.id))
      const puts: LocalRow[] = []
      locals.forEach((l, i) => {
        if (l && l.updatedAt === recs[i].updated_at && l.dirty) puts.push({ ...l, dirty: 0 })
      })
      if (puts.length) await t.bulkPut(puts)
    })
  }
}

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
  state: SyncState
  lastSync: number | null
  error?: string
}

type StatusListener = (s: SyncStatus) => void

export class SyncEngine {
  private status: SyncStatus = { state: 'off', lastSync: null }
  private listeners = new Set<StatusListener>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private interval: ReturnType<typeof setInterval> | null = null
  private running = false
  private again = false
  private unsub: (() => void) | null = null
  private userId: string | null = null

  constructor(
    private client: SupabaseClient,
    private onRemoteChange: (n: number) => void = () => {},
  ) {}

  subscribe(fn: StatusListener) {
    this.listeners.add(fn)
    fn(this.status)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private set(s: Partial<SyncStatus>) {
    this.status = { ...this.status, ...s }
    this.listeners.forEach((fn) => fn(this.status))
  }

  start(userId: string) {
    this.userId = userId
    this.set({ state: 'idle' })
    this.unsub?.()
    const off = onLocalChange(() => this.schedule(1500))
    const onOnline = () => this.schedule(200)
    const onVisible = () => document.visibilityState === 'visible' && this.schedule(200)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    this.interval = setInterval(() => this.schedule(0), 60_000)
    this.unsub = () => {
      off()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      if (this.interval) clearInterval(this.interval)
    }
    this.schedule(0)
  }

  stop() {
    this.unsub?.()
    this.unsub = null
    if (this.timer) clearTimeout(this.timer)
    this.userId = null
    this.set({ state: 'off' })
  }

  schedule(delay: number) {
    if (!this.userId) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  async run() {
    if (!this.userId) return
    if (this.running) {
      this.again = true
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ state: 'offline' })
      return
    }
    this.running = true
    this.set({ state: 'syncing' })
    const uid = this.userId
    try {
      await this.push(uid)
      const n = await this.pull(uid)
      if (n) this.onRemoteChange(n)
      this.set({ state: 'idle', lastSync: Date.now(), error: undefined })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.set({ state: navigator.onLine === false ? 'offline' : 'error', error: msg })
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        this.schedule(500)
      }
    }
  }

  private async push(userId: string) {
    const dirty = await collectDirty()
    for (let i = 0; i < dirty.length; i += 200) {
      const batch = dirty.slice(i, i + 200)
      const { error } = await this.client
        .from('records')
        .upsert(batch.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,tbl,id' })
      if (error) throw new Error(error.message)
      await markClean(batch)
    }
  }

  private async pull(userId: string): Promise<number> {
    const key = `pullCursor:${userId}`
    let cursor = await getMeta<string | null>(key, null)
    let total = 0
    for (let page = 0; page < 50; page++) {
      let q = this.client.from('records').select('tbl,id,data,updated_at,deleted,server_updated_at').order('server_updated_at', { ascending: true }).limit(500)
      // Pierwsza strona z 5 s zakładki — transakcje mogą się zatwierdzić w innej kolejności niż znaczniki czasu.
      if (cursor) q = q.gt('server_updated_at', page === 0 ? new Date(new Date(cursor).getTime() - 5000).toISOString() : cursor)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as RemoteRecord[]
      if (!rows.length) break
      total += await applyRemote(rows)
      const last = rows[rows.length - 1].server_updated_at!
      cursor = last
      await setMeta(key, cursor)
      if (rows.length < 500) break
    }
    return total
  }
}
