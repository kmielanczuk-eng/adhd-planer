import { db, notifyLocalChange, now, uid } from './db'
import { today } from './dates'
import { XP_FOR } from './gamification'
import type { DopamineItem, Note, Task, XpEvent, XpReason } from './types'

function base() {
  const t = now()
  return { id: uid(), createdAt: t, updatedAt: t, deleted: 0 as const, dirty: 1 as const }
}

export function newTask(partial: Partial<Task> = {}): Task {
  return {
    ...base(),
    title: '',
    details: '',
    status: 'open',
    due: null,
    estimate: null,
    energy: null,
    steps: [],
    tags: [],
    project: null,
    remindAt: null,
    pinnedFor: null,
    completedAt: null,
    noteId: null,
    skips: 0,
    ...partial,
  }
}

export function newNote(partial: Partial<Note> = {}): Note {
  return { ...base(), title: '', body: '', taskId: null, tags: [], pinned: false, ...partial }
}

// ---------- XP ----------

export async function awardXp(reason: XpReason, label: string, amount = XP_FOR[reason]): Promise<XpEvent> {
  const ev: XpEvent = { ...base(), amount, reason, label, day: today() }
  await db.xp.put(ev)
  notifyLocalChange()
  return ev
}

/** Cofa ostatnie XP za daną akcję (np. odhaczenie i odznaczenie tego samego) — żeby nie dało się „nabijać” punktów. */
export async function revokeLatestXp(reason: XpReason, label?: string) {
  const list = await db.xp.where('day').equals(today()).filter((x) => !x.deleted && x.reason === reason && (label == null || x.label === label)).toArray()
  const last = list.sort((a, b) => b.createdAt - a.createdAt)[0]
  if (last) await revokeXp(last.id)
}

export async function revokeXp(id: string | undefined) {
  if (!id) return
  await db.xp.update(id, { deleted: 1, dirty: 1, updatedAt: now() })
  notifyLocalChange()
}

// ---------- Inbox / brain dump ----------

/** Zrzut myśli: każda niepusta linia = osobny wpis w Inboxie. Zwraca utworzone id. */
export async function brainDump(text: string): Promise<string[]> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (!lines.length) return []
  const tasks = lines.map((title) => newTask({ title, status: 'inbox' }))
  await db.tasks.bulkPut(tasks)
  notifyLocalChange()
  void awardXp('dump', lines.length === 1 ? lines[0] : `${lines.length} myśli z głowy`, XP_FOR.dump * Math.min(lines.length, 5))
  return tasks.map((t) => t.id)
}

export async function updateTask(id: string, patch: Partial<Task>) {
  await db.tasks.update(id, { ...patch, updatedAt: now(), dirty: 1 })
  notifyLocalChange()
}

export async function getTask(id: string) {
  return db.tasks.get(id)
}

/** Przywraca dokładny stan sprzed zmiany (undo), z nowym znacznikiem czasu, żeby wygrał w sync. */
export async function restoreTask(snapshot: Task) {
  await db.tasks.put({ ...snapshot, updatedAt: now(), dirty: 1 })
  notifyLocalChange()
}

export async function restoreNote(snapshot: Note) {
  await db.notes.put({ ...snapshot, updatedAt: now(), dirty: 1 })
  notifyLocalChange()
}

export async function triageToTask(id: string, patch: Partial<Task> = {}) {
  await updateTask(id, { status: 'open', ...patch })
  void awardXp('triage', 'Inbox: zadanie')
}

export async function triageToNote(id: string): Promise<string | undefined> {
  const t = await db.tasks.get(id)
  if (!t) return
  const note = newNote({ title: t.title, body: t.details })
  await db.transaction('rw', db.tasks, db.notes, async () => {
    await db.notes.put(note)
    await db.tasks.update(id, { deleted: 1, dirty: 1, updatedAt: now() })
  })
  notifyLocalChange()
  void awardXp('triage', 'Inbox: notatka')
  return note.id
}

export async function deleteTask(id: string) {
  await updateTask(id, { deleted: 1 })
}

export async function createTask(partial: Partial<Task>) {
  const t = newTask(partial)
  await db.tasks.put(t)
  notifyLocalChange()
  return t
}

export interface CompleteResult {
  snapshot: Task
  xpId?: string
}

export async function completeTask(id: string): Promise<CompleteResult | undefined> {
  const t = await db.tasks.get(id)
  if (!t || t.status === 'done') return
  await updateTask(id, { status: 'done', completedAt: Date.now() })
  const ev = await awardXp('task', t.title)
  return { snapshot: t, xpId: ev.id }
}

export async function uncompleteTask(id: string) {
  const t = await db.tasks.get(id)
  if (!t || t.status !== 'done') return
  await updateTask(id, { status: 'open', completedAt: null })
  await revokeLatestXp('task', t.title)
}

export async function toggleStep(taskId: string, stepId: string): Promise<{ done: boolean; xpId?: string } | undefined> {
  const t = await db.tasks.get(taskId)
  if (!t) return
  const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s))
  const step = steps.find((s) => s.id === stepId)!
  await updateTask(taskId, { steps })
  if (step.done) {
    const ev = await awardXp('step', step.title)
    return { done: true, xpId: ev.id }
  }
  await revokeLatestXp('step', step.title)
  return { done: false }
}

export async function moveToToday(ids: string[]) {
  const d = today()
  await db.transaction('rw', db.tasks, async () => {
    for (const id of ids) await db.tasks.update(id, { due: d, updatedAt: now(), dirty: 1 })
  })
  notifyLocalChange()
}

// ---------- Notatki ----------

export async function createNote(partial: Partial<Note> = {}) {
  const n = newNote(partial)
  await db.notes.put(n)
  notifyLocalChange()
  return n
}

export async function updateNote(id: string, patch: Partial<Note>) {
  await db.notes.update(id, { ...patch, updatedAt: now(), dirty: 1 })
  notifyLocalChange()
}

export async function deleteNote(id: string) {
  await updateNote(id, { deleted: 1 })
}

// ---------- Menu dopaminowe ----------

export const DEFAULT_DOPAMINE: Array<Pick<DopamineItem, 'title' | 'minutes' | 'kind'>> = [
  { title: 'Szklanka wody i 10 głębokich oddechów', minutes: 2, kind: 'starter' },
  { title: 'Rozciąganie przy ulubionej piosence', minutes: 4, kind: 'starter' },
  { title: 'Wyjście na balkon / przed dom', minutes: 5, kind: 'starter' },
  { title: 'Krótki spacer bez telefonu', minutes: 15, kind: 'main' },
  { title: 'Taniec do jednej piosenki', minutes: 4, kind: 'main' },
  { title: 'Ciepły prysznic', minutes: 10, kind: 'main' },
  { title: 'Podcast / muzyka przy zmywaniu', minutes: null, kind: 'side' },
  { title: 'Fidget, gniotek, kostka w dłoni', minutes: null, kind: 'side' },
  { title: 'Scrollowanie social mediów (z timerem!)', minutes: 10, kind: 'dessert' },
  { title: 'Jeden odcinek serialu', minutes: 25, kind: 'dessert' },
]

export async function ensureDopamineDefaults() {
  const count = await db.dopamine.count()
  if (count > 0) return
  // Stałe id — te same domyślne pozycje na każdym urządzeniu nie zdublują się po synchronizacji.
  const items: DopamineItem[] = DEFAULT_DOPAMINE.map((d, i) => ({ ...base(), id: `default-dopamine-${i}`, createdAt: 0, updatedAt: 0, ...d, dirty: 0 }))
  await db.dopamine.bulkPut(items)
}

export async function addDopamine(item: Pick<DopamineItem, 'title' | 'minutes' | 'kind'>) {
  await db.dopamine.put({ ...base(), ...item })
  notifyLocalChange()
}

export async function deleteDopamine(id: string) {
  await db.dopamine.update(id, { deleted: 1, dirty: 1, updatedAt: now() })
  notifyLocalChange()
}
