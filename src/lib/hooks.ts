import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { DopamineItem, Note, Task, XpEvent } from './types'

const EMPTY: never[] = []

export function useTasks(): Task[] {
  return useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), [], EMPTY as Task[])
}

export function useTasksLoaded(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), [])
}

export function useTask(id: string | null): Task | undefined {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
}

export function useNotes(): Note[] {
  return useLiveQuery(() => db.notes.filter((n) => !n.deleted).toArray(), [], EMPTY as Note[])
}

export function useXp(): XpEvent[] {
  return useLiveQuery(() => db.xp.filter((x) => !x.deleted).toArray(), [], EMPTY as XpEvent[])
}

export function useDopamine(): DopamineItem[] {
  return useLiveQuery(() => db.dopamine.filter((x) => !x.deleted).toArray(), [], EMPTY as DopamineItem[])
}
