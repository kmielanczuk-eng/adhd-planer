import { describe, expect, it } from 'vitest'
import { computeStreak, levelInfo, xpForLevel } from '../src/lib/gamification'

describe('poziomy', () => {
  it('poziom 1 od zera, rośnie łagodnie', () => {
    expect(levelInfo(0).level).toBe(1)
    expect(xpForLevel(2)).toBe(50)
    expect(levelInfo(49).level).toBe(1)
    expect(levelInfo(50).level).toBe(2)
    expect(levelInfo(xpForLevel(5)).level).toBe(5)
  })
  it('postęp w ramach poziomu', () => {
    const l = levelInfo(75)
    expect(l.level).toBe(2)
    expect(l.into).toBe(25)
    expect(l.span).toBe(xpForLevel(3) - xpForLevel(2))
    expect(l.progress).toBeGreaterThan(0)
    expect(l.progress).toBeLessThan(1)
  })
})

describe('łagodna seria', () => {
  const T = '2026-10-11'
  it('pusta historia = brak serii', () => {
    const s = computeStreak([], T)
    expect(s.activeDays).toBe(0)
    expect(s.alive).toBe(false)
  })
  it('dziś jeszcze pusty nie zrywa serii', () => {
    const s = computeStreak(['2026-10-09', '2026-10-10'], T)
    expect(s.activeDays).toBe(2)
    expect(s.alive).toBe(true)
    expect(s.activeToday).toBe(false)
  })
  it('jeden pusty dzień = dzień wolny, seria trwa', () => {
    const s = computeStreak(['2026-10-07', '2026-10-08', '2026-10-10', '2026-10-11'], T)
    expect(s.activeDays).toBe(4)
    expect(s.restDays).toEqual(['2026-10-09'])
    expect(s.spanDays).toBe(5)
  })
  it('dwa puste dni z rzędu kończą serię (bez kary — nowa się zaczyna)', () => {
    const s = computeStreak(['2026-10-05', '2026-10-06', '2026-10-09', '2026-10-10', '2026-10-11'], T)
    expect(s.activeDays).toBe(3)
    expect(s.best).toBe(3)
  })
  it('wczoraj pusty, przedwczoraj aktywny — seria żyje', () => {
    const s = computeStreak(['2026-10-08', '2026-10-09'], T)
    expect(s.alive).toBe(true)
    expect(s.activeDays).toBe(2)
  })
  it('dwa ostatnie dni puste — brak bieżącej serii, najlepsza zapamiętana', () => {
    const s = computeStreak(['2026-10-06', '2026-10-07', '2026-10-08'], T)
    expect(s.alive).toBe(false)
    expect(s.activeDays).toBe(0)
    expect(s.best).toBe(3)
  })
  it('zadeklarowane dni wolne (urlop) nie przerywają serii', () => {
    const s = computeStreak(['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11'], T, [
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
    ])
    expect(s.activeDays).toBe(4)
    expect(s.best).toBe(4)
  })
})
