import { db } from './db'
import { completeTask, toggleStep, uncompleteTask, updateTask, awardXp } from './actions'
import { celebrate, playSound, vibrate } from './feedback'
import { levelInfo, randomCheer, XP_FOR } from './gamification'
import { pulseXp, showLevelUp, toast } from './ui'
import type { XpReason } from './types'

async function totalXp() {
  let sum = 0
  await db.xp.each((x) => {
    if (!x.deleted) sum += x.amount
  })
  return sum
}

async function withLevelCheck<T>(fn: () => Promise<T>): Promise<T> {
  const before = levelInfo(await totalXp()).level
  const res = await fn()
  const after = levelInfo(await totalXp()).level
  if (after > before) {
    setTimeout(() => {
      showLevelUp(after)
      playSound('level')
      celebrate(undefined, true)
    }, 700)
  }
  return res
}

function originFrom(el?: Element | null) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}

/** Ukończenie zadania z nagrodą i możliwością cofnięcia. */
export async function completeWithJoy(taskId: string, el?: Element | null) {
  const res = await withLevelCheck(() => completeTask(taskId))
  if (!res) return
  celebrate(originFrom(el))
  playSound('done')
  vibrate(20)
  pulseXp(XP_FOR.task)
  toast(`${randomCheer()} +${XP_FOR.task} XP`, {
    tone: 'success',
    // Cofnij zmienia tylko to, co zmieniło ukończenie (status + XP) — nie nadpisuje innych edycji.
    undo: () => uncompleteTask(taskId),
  })
}

export async function toggleStepWithJoy(taskId: string, stepId: string) {
  const res = await withLevelCheck(() => toggleStep(taskId, stepId))
  if (res?.done) {
    playSound('step')
    vibrate(10)
    pulseXp(XP_FOR.step)
    // Gdy to był ostatni krok — delikatnie zaproponuj ukończenie całości.
    const t = await db.tasks.get(taskId)
    if (t && t.status !== 'done' && t.steps.length > 0 && t.steps.every((s) => s.done)) {
      toast('Wszystkie kroki zrobione! Oznaczyć całe zadanie jako gotowe?', {
        tone: 'success',
        duration: 8000,
        actionLabel: 'Tak, gotowe',
        undo: () => completeWithJoy(taskId),
      })
    }
  }
}

export async function rewardXp(reason: XpReason, label: string, amount?: number) {
  await withLevelCheck(() => awardXp(reason, label, amount))
  pulseXp(amount ?? XP_FOR[reason])
}

export async function deleteTaskWithUndo(taskId: string) {
  const t = await db.tasks.get(taskId)
  if (!t) return
  await updateTask(taskId, { deleted: 1 })
  toast('Usunięto', { undo: () => updateTask(taskId, { deleted: 0 }) })
}
