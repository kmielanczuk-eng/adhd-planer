import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/lib/db'
import { applyRemote, collectDirty, markClean, mergeDecision, toRemote, type RemoteRecord } from '../src/lib/sync'
import { newTask } from '../src/lib/actions'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const remote = (id: string, updated_at: number, title: string, deleted = false): RemoteRecord => ({
  tbl: 'tasks',
  id,
  data: { ...newTask({ id, title }), updatedAt: updated_at },
  updated_at,
  deleted,
})

describe('last-write-wins', () => {
  it('decyzje scalania', () => {
    const local = { ...newTask({ title: 'a' }), updatedAt: 100 }
    expect(mergeDecision(undefined, remote('x', 1, 'r'))).toBe('apply')
    expect(mergeDecision(local, remote(local.id, 200, 'r'))).toBe('apply')
    expect(mergeDecision(local, remote(local.id, 100, 'r'))).toBe('mark-clean')
    expect(mergeDecision(local, remote(local.id, 50, 'r'))).toBe('keep-local')
  })

  it('zdalny nowszy nadpisuje lokalny, starszy nie', async () => {
    const a = { ...newTask({ title: 'lokalnie A' }), updatedAt: 100, dirty: 1 as const }
    const b = { ...newTask({ title: 'lokalnie B' }), updatedAt: 300, dirty: 1 as const }
    await db.tasks.bulkPut([a, b])
    await applyRemote([remote(a.id, 200, 'zdalnie A'), remote(b.id, 250, 'zdalnie B'), remote('nowy', 10, 'nowy')])
    expect((await db.tasks.get(a.id))?.title).toBe('zdalnie A')
    expect((await db.tasks.get(a.id))?.dirty).toBe(0)
    expect((await db.tasks.get(b.id))?.title).toBe('lokalnie B')
    expect((await db.tasks.get(b.id))?.dirty).toBe(1)
    expect((await db.tasks.get('nowy'))?.title).toBe('nowy')
  })

  it('soft delete przychodzi ze zdalnego', async () => {
    const a = { ...newTask({ title: 'A' }), updatedAt: 100, dirty: 0 as const }
    await db.tasks.put(a)
    await applyRemote([remote(a.id, 150, 'A', true)])
    expect((await db.tasks.get(a.id))?.deleted).toBe(1)
  })

  it('collectDirty + markClean pomija rekordy zmienione w trakcie wysyłki', async () => {
    const a = { ...newTask({ title: 'A' }), updatedAt: 100, dirty: 1 as const }
    const b = { ...newTask({ title: 'B' }), updatedAt: 100, dirty: 1 as const }
    await db.tasks.bulkPut([a, b])
    const sent = await collectDirty()
    expect(sent.filter((r) => r.tbl === 'tasks')).toHaveLength(2)
    // B zmienia się, zanim serwer odpowie
    await db.tasks.update(b.id, { title: 'B2', updatedAt: 200, dirty: 1 })
    await markClean(sent)
    expect((await db.tasks.get(a.id))?.dirty).toBe(0)
    expect((await db.tasks.get(b.id))?.dirty).toBe(1)
  })

  it('toRemote nie wysyła pola dirty', () => {
    const r = toRemote('tasks', { ...newTask({ title: 'x' }) })
    expect('dirty' in r.data).toBe(false)
    expect(r.deleted).toBe(false)
  })
})
