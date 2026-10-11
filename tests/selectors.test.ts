import { describe, expect, it } from 'vitest'
import { newTask } from '../src/lib/actions'
import { filterTasks, inboxTasks, pickTask, remainingEstimate, todayView, upcoming } from '../src/lib/selectors'
import type { Task } from '../src/lib/types'

const T = '2026-10-11'
const mk = (p: Partial<Task>) => newTask({ title: 'x', ...p })

describe('widoki zadań', () => {
  it('Dziś: przypięte, z terminem, z poprzednich dni, zrobione dziś', () => {
    const doneAt = new Date(2026, 9, 11, 10).getTime()
    const tasks = [
      mk({ title: 'pin', pinnedFor: T }),
      mk({ title: 'due', due: T }),
      mk({ title: 'old', due: '2026-10-01' }),
      mk({ title: 'future', due: '2026-10-20' }),
      mk({ title: 'done', status: 'done', completedAt: doneAt }),
      mk({ title: 'inbox', status: 'inbox', due: T }),
      mk({ title: 'deleted', due: T, deleted: 1 }),
    ]
    const v = todayView(tasks, T)
    expect(v.focus.map((t) => t.title)).toEqual(['pin'])
    expect(v.dueToday.map((t) => t.title)).toEqual(['due'])
    expect(v.carried.map((t) => t.title)).toEqual(['old'])
    expect(v.doneToday.map((t) => t.title)).toEqual(['done'])
  })
  it('Nadchodzące grupuje po dniu', () => {
    const g = upcoming([mk({ due: '2026-10-12' }), mk({ due: '2026-10-12' }), mk({ due: '2026-10-14' }), mk({ due: T })], T)
    expect(g.map((x) => [x.day, x.tasks.length])).toEqual([
      ['2026-10-12', 2],
      ['2026-10-14', 1],
    ])
  })
  it('Inbox: tylko wpisy inbox, najnowsze na górze', () => {
    const a = mk({ status: 'inbox', title: 'a', createdAt: 1 })
    const b = mk({ status: 'inbox', title: 'b', createdAt: 2 })
    expect(inboxTasks([a, b, mk({})]).map((t) => t.title)).toEqual(['b', 'a'])
  })
  it('filtr: tekst, tag, projekt', () => {
    const tasks = [mk({ title: 'Kup mleko', tags: ['dom'] }), mk({ title: 'Raport', project: 'Praca' })]
    expect(filterTasks(tasks, { query: 'mleko' })).toHaveLength(1)
    expect(filterTasks(tasks, { tag: 'dom' })).toHaveLength(1)
    expect(filterTasks(tasks, { project: 'Praca' })[0].title).toBe('Raport')
  })
})

describe('Co teraz?', () => {
  const noRandom = () => 0
  it('przy niskiej energii wybiera zadanie o niskiej energii', () => {
    const tasks = [mk({ title: 'trudne', energy: 'high' }), mk({ title: 'łatwe', energy: 'low' })]
    expect(pickTask(tasks, { energy: 'low', minutes: 15, todayKey: T, random: noRandom })?.title).toBe('łatwe')
  })
  it('dopasowuje do dostępnego czasu', () => {
    const tasks = [mk({ title: 'długie', estimate: 120 }), mk({ title: 'krótkie', estimate: 10 })]
    expect(pickTask(tasks, { energy: 'medium', minutes: 15, todayKey: T, random: noRandom })?.title).toBe('krótkie')
  })
  it('przypięte na dziś ma pierwszeństwo', () => {
    const tasks = [mk({ title: 'zwykłe' }), mk({ title: 'plan', pinnedFor: T })]
    expect(pickTask(tasks, { energy: 'medium', minutes: null, todayKey: T, random: noRandom })?.title).toBe('plan')
  })
  it('pomija wykluczone i zrobione', () => {
    const a = mk({ title: 'a' })
    const tasks = [a, mk({ title: 'b' }), mk({ title: 'c', status: 'done' })]
    expect(pickTask(tasks, { energy: 'medium', minutes: null, todayKey: T, exclude: [a.id], random: noRandom })?.title).toBe('b')
  })
  it('brak zadań → null', () => {
    expect(pickTask([], { energy: 'low', minutes: 5, todayKey: T })).toBeNull()
  })
  it('pozostały czas uwzględnia zrobione kroki', () => {
    const t = mk({ estimate: 40, steps: [{ id: '1', title: 'a', done: true }, { id: '2', title: 'b', done: false }] })
    expect(remainingEstimate(t)).toBe(20)
  })
})
