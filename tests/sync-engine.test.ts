import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '../src/lib/db'
import { SyncEngine, type RemoteRecord } from '../src/lib/sync'
import { createTask, updateTask } from '../src/lib/actions'

/** Symulacja tabeli `records` z triggerem LWW — tak jak w supabase/setup.sql. */
class FakeServer {
  rows = new Map<string, RemoteRecord & { user_id: string; server_updated_at: string }>()
  clock = Date.parse('2026-10-11T00:00:00Z')
  tick() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }
  client(): SupabaseClient {
    const server = this
    return {
      from() {
        return {
          upsert(rows: Array<RemoteRecord & { user_id: string }>) {
            for (const r of rows) {
              const key = `${r.user_id}/${r.tbl}/${r.id}`
              const old = server.rows.get(key)
              if (old && r.updated_at < old.updated_at) continue // trigger LWW
              server.rows.set(key, { ...structuredClone(r), server_updated_at: server.tick() })
            }
            return Promise.resolve({ error: null })
          },
          select() {
            let since: string | null = null
            let lim = 1000
            const q = {
              order: () => q,
              limit: (n: number) => ((lim = n), q),
              gt: (_c: string, v: string) => ((since = v), q),
              then(res: (v: { data: unknown; error: null }) => void) {
                const data = [...server.rows.values()]
                  .filter((r) => !since || r.server_updated_at > since)
                  .sort((a, b) => (a.server_updated_at < b.server_updated_at ? -1 : 1))
                  .slice(0, lim)
                  .map((r) => structuredClone(r))
                res({ data, error: null })
              },
            }
            return q
          },
        }
      },
    } as unknown as SupabaseClient
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function run(engine: SyncEngine) {
  ;(engine as unknown as { userId: string }).userId = 'u1'
  await engine.run()
}

describe('SyncEngine end-to-end (symulowany serwer)', () => {
  it('wysyła lokalne zmiany, oznacza je jako czyste i odbiera zmiany z innego urządzenia', async () => {
    const server = new FakeServer()
    const engine = new SyncEngine(server.client())
    const t = await createTask({ title: 'z telefonu' })
    await run(engine)
    expect(server.rows.size).toBe(1)
    expect((await db.tasks.get(t.id))?.dirty).toBe(0)

    // „drugie urządzenie” zmienia tytuł później
    const row = [...server.rows.values()][0]
    server.rows.set(`u1/tasks/${t.id}`, {
      ...row,
      data: { ...row.data, title: 'z komputera' },
      updated_at: row.updated_at + 5000,
      server_updated_at: server.tick(),
    })
    await run(engine)
    expect((await db.tasks.get(t.id))?.title).toBe('z komputera')
  })

  it('starsza zmiana z innego urządzenia nie nadpisuje nowszej lokalnej', async () => {
    const server = new FakeServer()
    const engine = new SyncEngine(server.client())
    const t = await createTask({ title: 'v1' })
    await run(engine)
    await updateTask(t.id, { title: 'v2 lokalnie' })
    const row = server.rows.get(`u1/tasks/${t.id}`)!
    server.rows.set(`u1/tasks/${t.id}`, { ...row, data: { ...row.data, title: 'stara' }, updated_at: row.updated_at + 0, server_updated_at: server.tick() })
    await run(engine)
    expect((await db.tasks.get(t.id))?.title).toBe('v2 lokalnie')
    expect(server.rows.get(`u1/tasks/${t.id}`)?.data.title).toBe('v2 lokalnie')
  })

  it('usunięcie (soft delete) dociera na serwer', async () => {
    const server = new FakeServer()
    const engine = new SyncEngine(server.client())
    const t = await createTask({ title: 'do usunięcia' })
    await run(engine)
    await updateTask(t.id, { deleted: 1 })
    await run(engine)
    expect(server.rows.get(`u1/tasks/${t.id}`)?.deleted).toBe(true)
  })
})
