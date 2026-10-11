import { useMemo, useState } from 'react'
import { useTasksLoaded, useXp } from '../lib/hooks'
import { inboxTasks, openTasks, sortOpen, todayView } from '../lib/selectors'
import { greeting, humanDay, plural, today, weekdayName } from '../lib/dates'
import { moveToToday, updateTask } from '../lib/actions'
import { useSettings } from '../lib/settings'
import { openDump, toast } from '../lib/ui'
import { navigate } from '../lib/router'
import { rewardXp } from '../lib/flows'
import { TaskList, TaskRow } from '../components/TaskRow'
import { Button, Empty, Section } from '../components/ui'
import { Icon } from '../components/Icon'
import type { Task } from '../lib/types'

export function TodayView() {
  const loaded = useTasksLoaded()
  const tasks = loaded ?? []
  const xp = useXp()
  const s = useSettings()
  const td = today()
  const v = useMemo(() => todayView(tasks, td), [tasks, td])
  const inboxCount = useMemo(() => inboxTasks(tasks).length, [tasks])
  const [picking, setPicking] = useState(false)
  const xpToday = xp.filter((x) => x.day === td).reduce((a, x) => a + x.amount, 0)

  const limit = s.dailyLimit
  const focusFull = v.focus.length >= limit
  const planned = v.focus.length > 0

  if (!loaded) return null

  return (
    <div>
      <header className="mb-5">
        <p className="text-muted text-sm capitalize">{weekdayName(td)}</p>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {greeting()}
          {s.name ? `, ${s.name}` : ''} 👋
        </h1>
        {v.doneToday.length > 0 ? (
          <p className="text-muted mt-1">
            Dziś zrobione: <strong className="text-accent">{v.doneToday.length}</strong> · +{xpToday} XP. Tak trzymaj, w swoim tempie.
          </p>
        ) : (
          <p className="text-muted mt-1">Jeden mały krok wystarczy na start.</p>
        )}
      </header>

      {new Date().getHours() >= 18 && v.doneToday.length + xp.filter((x) => x.day === td && x.reason === 'step').length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/postepy')}
          className="w-full mb-5 flex items-center justify-between gap-3 rounded-2xl bg-sun-soft px-4 min-h-14 text-left"
        >
          <span className="flex items-center gap-2">🫙 Zamknij dzień — zobacz, co się udało</span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      {inboxCount > 0 && (
        <button
          type="button"
          onClick={() => navigate('/inbox')}
          className="w-full mb-5 flex items-center justify-between gap-3 rounded-2xl bg-sky-soft px-4 min-h-14 text-left"
        >
          <span className="flex items-center gap-2">
            <Icon name="inbox" size={18} /> W Inboxie czeka {inboxCount} {plural(inboxCount, 'myśl', 'myśli', 'myśli')} do ogarnięcia
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      <Section
        title={`⭐ Na dziś (max ${limit})`}
        action={
          planned && !focusFull ? (
            <button type="button" className="text-sm text-accent font-medium min-h-10 px-2" onClick={() => setPicking(!picking)}>
              {picking ? 'Gotowe' : '+ Wybierz'}
            </button>
          ) : null
        }
      >
        {!planned && !picking ? (
          <div className="rounded-3xl border-2 border-dashed border-line p-5 text-center">
            <p className="font-semibold">Co jest dziś naprawdę ważne?</p>
            <p className="text-muted text-sm mt-1 mb-4">Wybierz maksymalnie {limit} rzeczy. Reszta może poczekać — i to jest w porządku.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon="star" onClick={() => setPicking(true)} disabled={openTasks(tasks).length === 0}>
                Zaplanuj dzień
              </Button>
              <Button icon="target" onClick={() => navigate('/teraz')}>
                Nie wiem, wybierz za mnie
              </Button>
            </div>
            {openTasks(tasks).length === 0 && <p className="text-xs text-muted mt-3">Najpierw dodaj coś przyciskiem „+” albo klawiszem N.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {v.focus.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
            {v.focus.length > 0 && v.focus.length >= limit && !picking && <p className="text-xs text-muted px-1">Plan jest pełny. Jak to zrobisz, wszystko inne to bonus. 🌱</p>}
          </div>
        )}
        {picking && <PlanPicker tasks={tasks} focus={v.focus} limit={limit} onDone={() => setPicking(false)} />}
      </Section>

      {v.dueToday.length > 0 && (
        <Section title="Z terminem na dziś" count={v.dueToday.length}>
          <TaskList tasks={v.dueToday} showDue={false} limit={5} />
        </Section>
      )}

      {v.carried.length > 0 && (
        <Section
          title="Z poprzednich dni"
          count={v.carried.length}
          collapsible
          defaultOpen={false}
          action={
            <button
              type="button"
              className="text-sm text-accent font-medium min-h-10 px-2"
              onClick={async () => {
                const ids = v.carried.map((t) => t.id)
                const prev = v.carried.map((t) => ({ id: t.id, due: t.due }))
                await moveToToday(ids)
                toast(`Przeniesiono ${ids.length} na dziś`, { undo: async () => { for (const p of prev) await updateTask(p.id, { due: p.due }) } })
              }}
            >
              Przenieś wszystkie na dziś
            </button>
          }
        >
          <p className="text-sm text-muted px-1 mb-2">Bez stresu — plany się zmieniają. Przenieść na dziś, na później, a może już nieaktualne?</p>
          <div className="flex flex-col gap-2">
            {v.carried.slice(0, 8).map((t) => (
              <CarriedRow key={t.id} task={t} />
            ))}
          </div>
        </Section>
      )}

      {v.doneToday.length > 0 && (
        <Section title="Zrobione dziś 🎉" count={v.doneToday.length} collapsible defaultOpen={false}>
          <TaskList tasks={v.doneToday} showDue={false} />
        </Section>
      )}

      {tasks.length === 0 && (
        <Empty emoji="🌤️" title="Czysta karta">
          Zacznij od wyrzucenia z głowy wszystkiego, co cię uwiera.
          <div className="mt-4">
            <Button variant="primary" icon="plus" onClick={openDump}>
              Zrzut myśli
            </Button>
          </div>
        </Empty>
      )}
    </div>
  )
}

function CarriedRow({ task }: { task: Task }) {
  return (
    <div className="rounded-2xl bg-surface border border-line/70">
      <TaskRow task={task} />
      <div className="flex flex-wrap gap-1.5 px-3 pb-3 -mt-1 pl-14">
        <button type="button" className="text-xs rounded-full bg-accent-soft text-accent px-3 min-h-8 font-medium" onClick={() => void updateTask(task.id, { due: today() })}>
          Na dziś
        </button>
        <button
          type="button"
          className="text-xs rounded-full bg-surface-2 px-3 min-h-8"
          onClick={() => {
            const d = new Date()
            d.setDate(d.getDate() + 1)
            void updateTask(task.id, { due: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
          }}
        >
          Jutro
        </button>
        <button type="button" className="text-xs rounded-full bg-surface-2 px-3 min-h-8" onClick={() => void updateTask(task.id, { due: null })}>
          Kiedyś
        </button>
        <span className="text-xs text-muted self-center ml-1">było na {humanDay(task.due!)}</span>
      </div>
    </div>
  )
}

function PlanPicker({ tasks, focus, limit, onDone }: { tasks: Task[]; focus: Task[]; limit: number; onDone: () => void }) {
  const td = today()
  const candidates = openTasks(tasks)
    .filter((t) => t.pinnedFor !== td)
    .sort((a, b) => sortOpen(a, b, td))
    .slice(0, 30)
  const toggle = async (t: Task) => {
    if (focus.length >= limit) {
      toast(`Już masz ${limit}. Możesz zmienić limit w Ustawieniach — ale mniej często znaczy więcej.`, { tone: 'info' })
      return
    }
    await updateTask(t.id, { pinnedFor: td })
    if (focus.length + 1 >= limit) {
      void rewardXp('plan', 'Plan dnia gotowy')
      toast('Plan na dziś gotowy! +3 XP', { tone: 'success' })
      onDone()
    }
  }
  if (!candidates.length) return <p className="text-sm text-muted mt-2 px-1">Brak innych otwartych zadań.</p>
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 p-2 max-h-80 overflow-y-auto">
      <p className="text-xs text-muted px-2 py-1">Stuknij, żeby dodać do planu na dziś:</p>
      {candidates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => void toggle(t)}
          className="w-full text-left flex items-center gap-3 rounded-xl px-3 min-h-12 hover:bg-surface"
        >
          <span className="text-lg">☆</span>
          <span className="flex-1 min-w-0 truncate">{t.title}</span>
          {t.due && <span className="text-xs text-muted">{humanDay(t.due)}</span>}
        </button>
      ))}
      <div className="flex justify-end p-1">
        <Button size="sm" onClick={onDone}>
          Gotowe
        </Button>
      </div>
    </div>
  )
}
