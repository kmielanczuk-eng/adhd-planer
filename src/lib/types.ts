export type Energy = 'low' | 'medium' | 'high'
export type TaskStatus = 'inbox' | 'open' | 'done'

/** Pola wspólne dla wszystkiego, co się synchronizuje. */
export interface SyncFields {
  id: string
  createdAt: number
  /** ms od epoki, ustawiane przez klienta przy każdej zmianie — podstawa last-write-wins */
  updatedAt: number
  /** soft delete — rekord zostaje, żeby usunięcie dotarło na inne urządzenia */
  deleted: 0 | 1
  /** 1 = zmiana lokalna, jeszcze nie wysłana na serwer (tylko lokalnie) */
  dirty: 0 | 1
}

export interface Step {
  id: string
  title: string
  done: boolean
}

export interface Task extends SyncFields {
  title: string
  details: string
  status: TaskStatus
  /** YYYY-MM-DD */
  due: string | null
  /** szacowany czas w minutach */
  estimate: number | null
  energy: Energy | null
  steps: Step[]
  tags: string[]
  project: string | null
  /** ISO, kiedy wysłać przypomnienie */
  remindAt: string | null
  /** przypięte do „3 na dziś” (YYYY-MM-DD, dzień przypięcia) */
  pinnedFor: string | null
  completedAt: number | null
  noteId: string | null
  /** ile razy pominięte w „Co teraz?” — delikatnie obniża priorytet */
  skips: number
}

export interface Note extends SyncFields {
  title: string
  body: string
  taskId: string | null
  tags: string[]
  pinned: boolean
}

export interface XpEvent extends SyncFields {
  amount: number
  reason: XpReason
  /** YYYY-MM-DD lokalnie */
  day: string
  label: string
}

export type XpReason = 'task' | 'step' | 'dump' | 'triage' | 'focus' | 'note' | 'plan' | 'break'

export interface DopamineItem extends SyncFields {
  title: string
  minutes: number | null
  kind: 'starter' | 'main' | 'side' | 'dessert'
}

export type TableName = 'tasks' | 'notes' | 'xp' | 'dopamine'
export const SYNC_TABLES: TableName[] = ['tasks', 'notes', 'xp', 'dopamine']
