import { addDays, diffDays } from './dates'
import type { XpReason } from './types'

export const XP_FOR: Record<XpReason, number> = {
  task: 10,
  step: 3,
  dump: 1,
  triage: 1,
  focus: 5,
  note: 2,
  plan: 3,
  break: 1,
}

export const LEVEL_NAMES = [
  'Iskierka',
  'Płomyczek',
  'Ognik',
  'Latarenka',
  'Ognisko',
  'Latarnia',
  'Kometa',
  'Gwiazda',
  'Supernowa',
  'Galaktyka',
]

/** XP potrzebne, by wejść na dany poziom (poziom 1 = 0 XP). Rośnie łagodnie: 50, 120, 210, 320… */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return 50 * n + 10 * n * (n - 1)
}

export interface LevelInfo {
  level: number
  name: string
  current: number
  /** XP zdobyte na tym poziomie */
  into: number
  /** XP potrzebne do następnego poziomu (od początku tego) */
  span: number
  progress: number
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1
  while (xpForLevel(level + 1) <= totalXp) level++
  const start = xpForLevel(level)
  const end = xpForLevel(level + 1)
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] + (level > LEVEL_NAMES.length ? ` ${level - LEVEL_NAMES.length + 1}` : '')
  return {
    level,
    name,
    current: totalXp,
    into: totalXp - start,
    span: end - start,
    progress: (totalXp - start) / (end - start),
  }
}

export interface StreakInfo {
  /** liczba dni aktywnych w bieżącej serii */
  activeDays: number
  /** długość serii w dniach kalendarzowych (z dniami wolnymi) */
  spanDays: number
  /** dni wolne „zużyte” w serii — nie zrywają jej */
  restDays: string[]
  /** czy dziś już coś było */
  activeToday: boolean
  /** czy seria nadal trwa (dziś lub wczoraj aktywny albo wczoraj był dniem wolnym) */
  alive: boolean
  best: number
}

/**
 * Łagodna seria: jeden pusty dzień pomiędzy aktywnymi to automatyczny „dzień wolny” 🌙 — seria trwa.
 * Dopiero dwa puste dni z rzędu kończą serię, a i wtedy nie ma żadnej kary — po prostu zaczyna się nowa.
 * Dodatkowo użytkownik może oznaczyć dowolne dni jako wolne (urlop, choroba) — te nigdy nie przerywają serii.
 */
export function computeStreak(activeDaysInput: Iterable<string>, todayKey: string, declaredRest: Iterable<string> = []): StreakInfo {
  const active = new Set(activeDaysInput)
  const rest = new Set(declaredRest)
  const activeToday = active.has(todayKey)

  // Bieżąca seria liczona wstecz. Dzisiejszy pusty dzień jeszcze się nie liczy — dzień trwa.
  const start = activeToday ? todayKey : addDays(todayKey, -1)
  let d = start
  let activeDays = 0
  let lastActive = start
  let gapRun = 0
  let pending: string[] = []
  const restDays: string[] = []
  for (let i = 0; i < 3700; i++) {
    if (active.has(d)) {
      activeDays++
      lastActive = d
      restDays.push(...pending)
      pending = []
      gapRun = 0
    } else if (rest.has(d)) {
      pending.push(d)
      gapRun = 0
    } else {
      gapRun++
      if (gapRun >= 2) break
      pending.push(d)
    }
    d = addDays(d, -1)
  }
  const alive = activeDays > 0

  // Najlepsza seria w historii (liczona w dniach aktywnych).
  let best = 0
  const sorted = [...active].sort()
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      run = 1
    } else {
      let consecutive = 0
      let broke = false
      for (let g = addDays(sorted[i - 1], 1); g < sorted[i]; g = addDays(g, 1)) {
        if (rest.has(g)) consecutive = 0
        else if (++consecutive >= 2) broke = true
      }
      run = broke ? 1 : run + 1
    }
    best = Math.max(best, run)
  }

  return {
    activeDays,
    spanDays: alive ? diffDays(start, lastActive) + 1 : 0,
    restDays: alive ? restDays : [],
    activeToday,
    alive,
    best,
  }
}

const CHEERS = [
  'Brawo! Jedna rzecz mniej w głowie.',
  'Zrobione! Twój mózg zasłużył na przybicie piątki.',
  'Tak jest! Mały krok, prawdziwy postęp.',
  'Odhaczone. Czujesz tę lekkość?',
  'Świetnie! To się liczy.',
  'Gotowe! Kolejny żeton do słoika.',
  'Pięknie. Nie musisz robić wszystkiego — to wystarczy.',
]

export function randomCheer(): string {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)]
}
