import { addDays, diffDays } from './dates'
import type { Energy, Task } from './types'

const live = (t: Task) => !t.deleted

export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => live(t) && t.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt)
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => live(t) && t.status === 'open')
}

/** Sortowanie: przypięte na dziś → z terminem (najbliższe) → reszta od najnowszych. */
export function sortOpen(a: Task, b: Task, todayKey: string): number {
  const pa = a.pinnedFor === todayKey ? 0 : 1
  const pb = b.pinnedFor === todayKey ? 0 : 1
  if (pa !== pb) return pa - pb
  if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1
  if (a.due && !b.due) return -1
  if (!a.due && b.due) return 1
  return b.createdAt - a.createdAt
}

export interface TodayView {
  /** przypięte do „3 na dziś” */
  focus: Task[]
  /** termin dziś (nieprzypięte) */
  dueToday: Task[]
  /** z poprzednich dni — pokazywane łagodnie */
  carried: Task[]
  doneToday: Task[]
}

export function todayView(tasks: Task[], todayKey: string): TodayView {
  const open = openTasks(tasks)
  const focus = open.filter((t) => t.pinnedFor === todayKey).sort((a, b) => sortOpen(a, b, todayKey))
  const rest = open.filter((t) => t.pinnedFor !== todayKey)
  const dueToday = rest.filter((t) => t.due === todayKey).sort((a, b) => b.createdAt - a.createdAt)
  const carried = rest.filter((t) => t.due && t.due < todayKey).sort((a, b) => (a.due! < b.due! ? 1 : -1))
  const doneToday = tasks
    .filter((t) => live(t) && t.status === 'done' && t.completedAt && dayOf(t.completedAt) === todayKey)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  return { focus, dueToday, carried, doneToday }
}

export function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface UpcomingGroup {
  day: string
  tasks: Task[]
}

export function upcoming(tasks: Task[], todayKey: string, days = 14): UpcomingGroup[] {
  const limit = addDays(todayKey, days)
  const open = openTasks(tasks).filter((t) => t.due && t.due > todayKey && t.due <= limit)
  const map = new Map<string, Task[]>()
  for (const t of open) {
    const arr = map.get(t.due!) ?? []
    arr.push(t)
    map.set(t.due!, arr)
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, ts]) => ({ day, tasks: ts }))
}

export function laterTasks(tasks: Task[], todayKey: string, days = 14): Task[] {
  const limit = addDays(todayKey, days)
  return openTasks(tasks)
    .filter((t) => t.due && t.due > limit)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
}

export interface TaskFilter {
  query?: string
  tag?: string | null
  project?: string | null
  energy?: Energy | null
}

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  const q = f.query?.trim().toLowerCase()
  return tasks.filter((t) => {
    if (q && !(t.title.toLowerCase().includes(q) || t.details.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q))))
      return false
    if (f.tag && !t.tags.includes(f.tag)) return false
    if (f.project && t.project !== f.project) return false
    if (f.energy && t.energy !== f.energy) return false
    return true
  })
}

export function allTags(tasks: Task[]): string[] {
  const s = new Set<string>()
  tasks.forEach((t) => !t.deleted && t.tags.forEach((g) => s.add(g)))
  return [...s].sort((a, b) => a.localeCompare(b, 'pl'))
}

export function allProjects(tasks: Task[]): string[] {
  const s = new Set<string>()
  tasks.forEach((t) => !t.deleted && t.project && s.add(t.project))
  return [...s].sort((a, b) => a.localeCompare(b, 'pl'))
}

export function doneTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => live(t) && t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
}

// ---------------- „Co teraz?” ----------------

const ENERGY_LEVEL: Record<Energy, number> = { low: 1, medium: 2, high: 3 }

export interface PickOptions {
  energy: Energy
  /** dostępny czas w minutach (null = nie wiem / dużo) */
  minutes: number | null
  todayKey: string
  exclude?: string[]
  random?: () => number
}

/** Pozostały czas zadania: jeśli ma kroki, szacujemy proporcjonalnie do niezrobionych. */
export function remainingEstimate(t: Task): number | null {
  if (!t.estimate) return null
  if (!t.steps.length) return t.estimate
  const left = t.steps.filter((s) => !s.done).length
  return Math.max(5, Math.round((t.estimate * left) / t.steps.length))
}

export function scoreTask(t: Task, o: PickOptions): number {
  let score = 0
  const need = t.energy ? ENERGY_LEVEL[t.energy] : 2
  const have = ENERGY_LEVEL[o.energy]
  if (need > have) score -= 40 * (need - have)
  else score += 10 - 3 * (have - need)

  const est = remainingEstimate(t)
  if (o.minutes != null) {
    if (est == null) score += 2
    else if (est <= o.minutes) score += 12 + Math.min(8, (est / o.minutes) * 8)
    else score -= 25 + Math.min(30, (est - o.minutes) / 5)
  }

  if (t.pinnedFor === o.todayKey) score += 30
  if (t.due) {
    const d = diffDays(t.due, o.todayKey)
    if (d <= 0) score += 15 + Math.min(5, -d)
    else if (d <= 2) score += 10 - d * 3
  }
  // Zaczęte zadania (z odhaczonymi krokami) łatwiej dokończyć.
  if (t.steps.some((s) => s.done)) score += 6
  // Kroki = łatwiejszy start.
  if (t.steps.some((s) => !s.done)) score += 4
  score -= Math.min(15, t.skips * 5)
  return score
}

export function pickTask(tasks: Task[], o: PickOptions): Task | null {
  const rnd = o.random ?? Math.random
  const candidates = openTasks(tasks).filter((t) => !o.exclude?.includes(t.id))
  if (!candidates.length) return null
  const scored = candidates.map((t) => ({ t, s: scoreTask(t, o) + rnd() * 6 })).sort((a, b) => b.s - a.s)
  return scored[0].t
}

export function nextStep(t: Task) {
  return t.steps.find((s) => !s.done) ?? null
}
