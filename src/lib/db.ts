import Dexie, { type EntityTable } from 'dexie'
import type { DopamineItem, Note, Task, XpEvent, TableName, SyncFields } from './types'

export interface MetaRow {
  key: string
  value: unknown
}

export class PlannerDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  notes!: EntityTable<Note, 'id'>
  xp!: EntityTable<XpEvent, 'id'>
  dopamine!: EntityTable<DopamineItem, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'ogarniacz') {
    super(name)
    this.version(1).stores({
      tasks: 'id, status, due, updatedAt, dirty, deleted, completedAt, pinnedFor, noteId',
      notes: 'id, updatedAt, dirty, deleted, taskId',
      xp: 'id, day, updatedAt, dirty, deleted',
      dopamine: 'id, updatedAt, dirty, deleted',
      meta: 'key',
    })
  }
}

export const db = new PlannerDB()

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function table(name: TableName) {
  return db.table<SyncFields & Record<string, unknown>, string>(name)
}

/** Monotoniczny zegar — dwie zmiany w tej samej ms nadal mają rosnący updatedAt. */
let lastNow = 0
export function now(): number {
  const t = Date.now()
  lastNow = t > lastNow ? t : lastNow + 1
  return lastNow
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

/** Wywoływane po każdej lokalnej zmianie — sync nasłuchuje i wysyła w tle. */
type Listener = () => void
const listeners = new Set<Listener>()
export function onLocalChange(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function notifyLocalChange() {
  listeners.forEach((fn) => fn())
}
