import { useEffect, useRef, useState } from 'react'
import { endFocus, useUI, type FocusSession } from '../lib/ui'
import { useTask } from '../lib/hooks'
import { nextStep } from '../lib/selectors'
import { formatTime } from '../lib/dates'
import { playSound, vibrate } from '../lib/feedback'
import { completeWithJoy, rewardXp, toggleStepWithJoy } from '../lib/flows'
import { updateTask } from '../lib/actions'
import { uid } from '../lib/db'
import { navigate } from '../lib/router'
import { showLocalNotification } from '../lib/notify'
import { Icon } from './Icon'
import { Button } from './ui'

export function FocusHost() {
  const focus = useUI((s) => s.focus)
  if (!focus) return null
  return <FocusTimer key={`${focus.taskId}-${focus.minutes}-${focus.title}`} session={focus} />
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Wedge (wycinek koła) jak w Time Timerze — kurczy się w miarę upływu czasu. */
function wedgePath(fraction: number, r = 100) {
  const f = Math.min(0.99999, Math.max(0, fraction))
  if (f <= 0) return ''
  const angle = f * 2 * Math.PI
  const x = 110 + r * Math.sin(angle)
  const y = 110 - r * Math.cos(angle)
  const large = f > 0.5 ? 1 : 0
  return `M110 110 L110 ${110 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`
}

function FocusTimer({ session }: { session: FocusSession }) {
  const task = useTask(session.taskId)
  const [total, setTotal] = useState(session.minutes * 60_000)
  const [endAt, setEndAt] = useState(() => Date.now() + session.minutes * 60_000)
  const [paused, setPaused] = useState<number | null>(null) // pozostały czas w chwili pauzy
  const [nowTs, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [firstMove, setFirstMove] = useState('')
  const marks = useRef<Set<number>>(new Set())
  const started = useRef(Date.now())

  const remaining = paused ?? endAt - nowTs
  const fraction = remaining / total

  useEffect(() => {
    if (paused != null || finished) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [paused, finished])

  // Delikatne „pulsy” w połowie i przy 80% — bez alarmów, tylko informacja dla ślepoty czasowej.
  useEffect(() => {
    if (finished || paused != null) return
    const elapsed = 1 - fraction
    for (const m of [0.5, 0.8]) {
      if (elapsed >= m && !marks.current.has(m)) {
        marks.current.add(m)
        vibrate(30)
        playSound('step')
      }
    }
    if (remaining <= 0) {
      setFinished(true)
      playSound('timer')
      vibrate(200)
      if (document.visibilityState !== 'visible') {
        void showLocalNotification('Czas minął ⏰', session.starter ? 'Udało się zacząć! Lecisz dalej czy przerwa?' : `Koniec sesji: ${session.title}`)
      }
      const mins = Math.max(1, Math.round((Date.now() - started.current) / 60000))
      void rewardXp('focus', `Skupienie ${mins} min: ${session.title}`)
    }
  }, [fraction, remaining, finished, paused, session])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const extend = (min: number) => {
    const add = min * 60_000
    if (finished) {
      setTotal(add)
      setEndAt(Date.now() + add)
      setNow(Date.now())
      setFinished(false)
      marks.current = new Set()
    } else if (paused != null) {
      setPaused(paused + add)
      setTotal(total + add)
    } else {
      setEndAt(endAt + add)
      setTotal(total + add)
    }
  }

  const togglePause = () => {
    if (paused != null) {
      setEndAt(Date.now() + paused)
      setNow(Date.now())
      setPaused(null)
    } else {
      setPaused(endAt - Date.now())
    }
  }

  const step = task ? nextStep(task) : null
  const finishAt = new Date(Date.now() + Math.max(0, remaining))
  const color = 'var(--accent)'

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col items-center justify-between safe-top safe-bottom anim-fade" role="dialog" aria-modal="true" aria-label="Tryb skupienia">
      <div className="w-full flex items-center justify-between px-4 pt-3">
        <span className="text-sm text-muted font-medium">{session.starter ? 'Tylko 5 minut ✨' : 'Skupienie'}</span>
        <button type="button" onClick={endFocus} className="min-w-11 min-h-11 grid place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Zamknij timer">
          <Icon name="x" />
        </button>
      </div>

      <div className="flex flex-col items-center px-6 w-full max-w-md">
        <h2 className="text-xl sm:text-2xl font-semibold text-center leading-snug mb-1 break-words">{session.title}</h2>
        {step && !finished && (
          <button
            type="button"
            onClick={() => task && void toggleStepWithJoy(task.id, step.id)}
            className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-surface border border-line px-4 min-h-12 text-left"
          >
            <span className="w-6 h-6 rounded-lg border-2 border-muted/50 shrink-0" />
            <span>
              <span className="text-xs text-muted block">Teraz tylko to:</span>
              {step.title}
            </span>
          </button>
        )}
        {!step && task && !finished && session.starter && (
          <div className="mt-3 w-full">
            <label className="text-sm text-muted block mb-1 text-center">Jaki jest pierwszy, fizyczny ruch? (opcjonalnie)</label>
            <div className="flex gap-2">
              <input
                value={firstMove}
                onChange={(e) => setFirstMove(e.target.value)}
                placeholder="np. otwieram laptopa"
                className="flex-1 min-h-11 rounded-xl bg-surface-2 px-3 outline-none"
              />
              {firstMove.trim() && (
                <Button
                  size="sm"
                  onClick={() => {
                    void updateTask(task.id, { steps: [{ id: uid(), title: firstMove.trim(), done: false }, ...task.steps] })
                    setFirstMove('')
                  }}
                >
                  OK
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="relative my-6 w-[min(78vw,340px)] aspect-square" aria-live="off">
          <svg viewBox="0 0 220 220" className="w-full h-full drop-shadow-sm">
            <circle cx="110" cy="110" r="106" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 2 * Math.PI
              return <line key={i} x1={110 + 96 * Math.sin(a)} y1={110 - 96 * Math.cos(a)} x2={110 + 104 * Math.sin(a)} y2={110 - 104 * Math.cos(a)} stroke="var(--line)" strokeWidth="2" />
            })}
            {!finished && <path d={wedgePath(fraction)} fill={color} opacity={paused != null ? 0.45 : 0.85} className={paused != null ? 'anim-pulse' : ''} />}
            <circle cx="110" cy="110" r="38" fill="var(--surface)" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums" role="timer" aria-label={`Zostało ${fmt(remaining)}`}>
                {finished ? '🎉' : fmt(remaining)}
              </div>
            </div>
          </div>
        </div>

        {!finished ? (
          <p className="text-muted text-sm text-center">{paused != null ? 'Pauza. Nic się nie stało.' : `Koniec ok. ${formatTime(finishAt)}`}</p>
        ) : (
          <div className="text-center anim-pop">
            <p className="text-lg font-semibold">{session.starter ? 'Udało się zacząć! To było najtrudniejsze.' : 'Czas minął. Świetna robota!'}</p>
            <p className="text-muted text-sm mt-1">Zatrzymanie się teraz też jest sukcesem.</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-md px-4 pb-6 grid grid-cols-2 gap-2">
        {!finished ? (
          <>
            <Button size="lg" icon={paused != null ? 'play' : 'pause'} onClick={togglePause}>
              {paused != null ? 'Wznów' : 'Pauza'}
            </Button>
            <Button size="lg" onClick={() => extend(5)}>
              +5 min
            </Button>
            {task && task.status !== 'done' && (
              <Button
                size="lg"
                variant="primary"
                icon="check"
                className="col-span-2"
                onClick={(e) => {
                  void completeWithJoy(task.id, e.currentTarget)
                  endFocus()
                }}
              >
                Zrobione!
              </Button>
            )}
            <Button size="lg" variant="ghost" className="col-span-2" onClick={endFocus}>
              Na razie wystarczy
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" variant="primary" onClick={() => extend(session.starter ? 10 : 5)}>
              {session.starter ? 'Lecę dalej +10' : '+5 min'}
            </Button>
            <Button size="lg" onClick={() => extend(25)}>
              +25 min
            </Button>
            {task && task.status !== 'done' && (
              <Button
                size="lg"
                icon="check"
                onClick={(e) => {
                  void completeWithJoy(task.id, e.currentTarget)
                  endFocus()
                }}
              >
                Zrobione!
              </Button>
            )}
            <Button
              size="lg"
              icon="coffee"
              className={task && task.status !== 'done' ? '' : 'col-span-2'}
              onClick={() => {
                endFocus()
                navigate('/przerwa')
              }}
            >
              Przerwa
            </Button>
            <Button size="lg" variant="ghost" className="col-span-2" onClick={endFocus}>
              Wystarczy na teraz
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
