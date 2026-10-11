import { useEffect, useMemo, useState } from 'react'
import { useTasksLoaded } from '../lib/hooks'
import { nextStep, openTasks, pickTask, remainingEstimate } from '../lib/selectors'
import { today, formatMinutes, humanDay } from '../lib/dates'
import { updateTask } from '../lib/actions'
import { completeWithJoy, toggleStepWithJoy } from '../lib/flows'
import { openDump, openTask, startFocus } from '../lib/ui'
import { useRoute, navigate } from '../lib/router'
import { useSettings } from '../lib/settings'
import type { Energy, Task } from '../lib/types'
import { Icon } from '../components/Icon'
import { Button, Chip, Empty } from '../components/ui'
import { ENERGY_EMOJI } from '../components/TaskRow'

const TIME_OPTS: Array<[string, number | null]> = [
  ['5 min', 5],
  ['15 min', 15],
  ['30 min', 30],
  ['1 h', 60],
  ['Więcej', null],
]

const ENERGY_OPTS: Array<[Energy, string]> = [
  ['low', 'Mało'],
  ['medium', 'Średnio'],
  ['high', 'Dużo'],
]

function readPref<T>(key: string, def: T): T {
  try {
    const v = sessionStorage.getItem('now:' + key)
    return v == null ? def : (JSON.parse(v) as T)
  } catch {
    return def
  }
}
function writePref(key: string, v: unknown) {
  try {
    sessionStorage.setItem('now:' + key, JSON.stringify(v))
  } catch {
    /* ignoruj */
  }
}

export function NowView() {
  const loaded = useTasksLoaded()
  const tasks = useMemo(() => loaded ?? [], [loaded])
  const route = useRoute()
  const s = useSettings()
  const [energy, setEnergy] = useState<Energy>(() => readPref('energy', 'medium'))
  const [minutes, setMinutes] = useState<number | null>(() => readPref('minutes', 15))
  const [currentId, setCurrentId] = useState<string | null>(() => route.query.get('task') ?? readPref<string | null>('current', null))
  const [skipped, setSkipped] = useState<string[]>([])
  const [shuffling, setShuffling] = useState(false)

  const open = useMemo(() => openTasks(tasks), [tasks])
  const current = open.find((t) => t.id === currentId) ?? null

  useEffect(() => writePref('energy', energy), [energy])
  useEffect(() => writePref('minutes', minutes), [minutes])
  useEffect(() => writePref('current', currentId), [currentId])

  // Wejście z przypomnienia: #/teraz?task=…
  useEffect(() => {
    const id = route.query.get('task')
    if (id) setCurrentId(id)
  }, [route])

  const pick = (exclude: string[] = skipped) => {
    setShuffling(true)
    setTimeout(() => setShuffling(false), 350)
    const t = pickTask(tasks, { energy, minutes, todayKey: today(), exclude })
    if (!t && exclude.length) {
      // wszystko pominięte — zaczynamy od nowa
      setSkipped([])
      setCurrentId(pickTask(tasks, { energy, minutes, todayKey: today() })?.id ?? null)
      return
    }
    setCurrentId(t?.id ?? null)
  }

  const skip = async () => {
    if (!current) return
    const ex = [...skipped, current.id]
    setSkipped(ex)
    await updateTask(current.id, { skips: (current.skips ?? 0) + 1 })
    pick(ex)
  }

  if (!loaded) return null

  if (!open.length) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Co teraz?</h1>
        <Empty emoji="🌿" title="Nie ma nic otwartego">
          Albo wszystko zrobione (brawo!), albo czas wyrzucić coś z głowy.
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <Button variant="primary" icon="plus" onClick={openDump}>
              Zrzut myśli
            </Button>
            <Button icon="coffee" onClick={() => navigate('/przerwa')}>
              Zasłużona przerwa
            </Button>
          </div>
        </Empty>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold">Co teraz?</h1>
      <p className="text-muted mt-1 mb-5">Jedna rzecz. Tylko ta. Reszta poczeka.</p>

      <div className="rounded-3xl bg-surface border border-line/70 p-4 mb-4">
        <p className="text-sm font-semibold text-muted mb-2">Ile masz energii?</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {ENERGY_OPTS.map(([e, label]) => (
            <Chip key={e} tone="sun" active={energy === e} onClick={() => setEnergy(e)}>
              {ENERGY_EMOJI[e]} {label}
            </Chip>
          ))}
        </div>
        <p className="text-sm font-semibold text-muted mb-2">Ile masz czasu?</p>
        <div className="flex gap-2 flex-wrap">
          {TIME_OPTS.map(([label, m]) => (
            <Chip key={label} tone="lav" active={minutes === m} onClick={() => setMinutes(m)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {!current ? (
        <div className="text-center py-6">
          <Button size="lg" variant="primary" icon="sparkles" onClick={() => pick()} data-testid="pick-for-me">
            Nie wiem, od czego zacząć
          </Button>
          <p className="text-sm text-muted mt-3">Wybiorę jedną rzecz pasującą do twojej energii i czasu.</p>
        </div>
      ) : (
        <CurrentCard task={current} shuffling={shuffling} onSkip={() => void skip()} onClear={() => setCurrentId(null)} focusMinutes={s.focusMinutes} minutes={minutes} />
      )}
    </div>
  )
}

function CurrentCard({
  task,
  shuffling,
  onSkip,
  onClear,
  focusMinutes,
  minutes,
}: {
  task: Task
  shuffling: boolean
  onSkip: () => void
  onClear: () => void
  focusMinutes: number
  minutes: number | null
}) {
  const step = nextStep(task)
  const est = remainingEstimate(task)
  const sessionMin = Math.min(minutes ?? focusMinutes, est ?? focusMinutes) || focusMinutes
  return (
    <div className={`rounded-3xl bg-surface border-2 border-accent/30 shadow-sm p-5 sm:p-6 ${shuffling ? 'anim-pop' : ''}`} data-testid="now-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Twoja jedna rzecz</p>
        <button type="button" onClick={onClear} className="text-xs text-muted underline min-h-8">
          wyczyść
        </button>
      </div>
      <button type="button" onClick={() => openTask(task.id)} className="block text-left mt-1 text-2xl font-bold leading-snug break-words">
        {task.title}
      </button>
      <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted">
        {est && (
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={14} /> ok. {formatMinutes(est)}
          </span>
        )}
        {task.due && (
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar" size={14} /> {humanDay(task.due)}
          </span>
        )}
        {task.steps.length > 0 && (
          <span>
            kroki {task.steps.filter((s) => s.done).length}/{task.steps.length}
          </span>
        )}
      </div>

      {step && (
        <button
          type="button"
          onClick={() => void toggleStepWithJoy(task.id, step.id)}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl bg-accent-soft px-4 min-h-14 text-left"
        >
          <span className="w-6 h-6 rounded-lg border-2 border-accent shrink-0" />
          <span>
            <span className="block text-xs text-muted">Następny mały krok:</span>
            <span className="font-medium">{step.title}</span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button size="lg" variant="primary" icon="play" className="col-span-2" onClick={() => startFocus({ taskId: task.id, title: task.title, minutes: 5, starter: true })}>
          Zacznij — tylko 5 minut
        </Button>
        <Button icon="clock" onClick={() => startFocus({ taskId: task.id, title: task.title, minutes: sessionMin, starter: false })}>
          Timer {sessionMin} min
        </Button>
        <Button icon="check" onClick={(e) => void completeWithJoy(task.id, e.currentTarget).then(onClear)}>
          Zrobione
        </Button>
        <Button variant="ghost" icon="shuffle" className="col-span-2" onClick={onSkip}>
          Nie teraz — daj coś innego
        </Button>
      </div>
      {!step && (
        <button type="button" onClick={() => openTask(task.id)} className="mt-3 text-sm text-muted underline w-full text-center min-h-10">
          Za duże? Rozbij na małe kroki
        </button>
      )}
    </div>
  )
}
