import { useMemo, useState } from 'react'
import { useTasksLoaded } from '../lib/hooks'
import { allProjects, allTags, doneTasks, filterTasks, laterTasks, openTasks, sortOpen, upcoming } from '../lib/selectors'
import { humanDay, today, weekdayName, addDays } from '../lib/dates'
import { createTask } from '../lib/actions'
import { navigate, useRoute } from '../lib/router'
import { TaskList } from '../components/TaskRow'
import { Empty, Section, Segmented } from '../components/ui'
import { Icon } from '../components/Icon'
import { toast } from '../lib/ui'

type Tab = 'nadchodzace' | 'wszystkie' | 'ukonczone'

export function TasksView() {
  const route = useRoute()
  const tab = (route.parts[1] as Tab) || 'wszystkie'
  const loaded = useTasksLoaded()
  const tasks = useMemo(() => loaded ?? [], [loaded])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [project, setProject] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const td = today()
  const tags = useMemo(() => allTags(tasks), [tasks])
  const projects = useMemo(() => allProjects(tasks), [tasks])
  const filtered = useMemo(() => filterTasks(tasks, { query, tag, project }), [tasks, query, tag, project])

  const addQuick = async () => {
    const title = quick.trim()
    if (!title) return
    setQuick('')
    await createTask({ title, due: tab === 'nadchodzace' ? addDays(td, 1) : null })
    toast('Dodano zadanie', { tone: 'success' })
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Zadania</h1>
      <Segmented<Tab>
        className="mb-4 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
        value={tab}
        onChange={(v) => navigate('/zadania/' + v, true)}
        options={[
          { value: 'nadchodzace', label: 'Nadchodzące' },
          { value: 'wszystkie', label: 'Wszystkie' },
          { value: 'ukonczone', label: 'Ukończone' },
        ]}
      />

      {tab !== 'ukonczone' && (
        <div className="flex gap-2 mb-4">
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addQuick()}
            placeholder={tab === 'nadchodzace' ? '+ Szybkie zadanie na jutro' : '+ Szybkie zadanie'}
            aria-label="Nowe zadanie"
            data-testid="quick-add"
            className="flex-1 min-h-12 rounded-2xl bg-surface border border-line px-4 outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      )}

      {(tags.length > 0 || projects.length > 0 || tasks.length > 8) && (
        <div className="mb-4 flex flex-col gap-2">
          <label className="relative">
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj…"
              aria-label="Szukaj zadań"
              className="w-full min-h-11 rounded-2xl bg-surface-2 pl-10 pr-3 outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          {(tags.length > 0 || projects.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {projects.map((p) => (
                <button
                  key={'p' + p}
                  type="button"
                  onClick={() => setProject(project === p ? null : p)}
                  className={`shrink-0 rounded-full px-3 min-h-9 text-sm inline-flex items-center gap-1 ${project === p ? 'bg-ink text-bg' : 'bg-surface-2 text-muted'}`}
                >
                  <Icon name="folder" size={13} /> {p}
                </button>
              ))}
              {tags.map((t) => (
                <button
                  key={'t' + t}
                  type="button"
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`shrink-0 rounded-full px-3 min-h-9 text-sm ${tag === t ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'}`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'nadchodzace' && <Upcoming tasks={filtered} />}
      {tab === 'wszystkie' && <All tasks={filtered} />}
      {tab === 'ukonczone' && <Done tasks={filtered} />}
    </div>
  )
}

function Upcoming({ tasks }: { tasks: ReturnType<typeof openTasks> }) {
  const td = today()
  const groups = upcoming(tasks, td, 14)
  const later = laterTasks(tasks, td, 14)
  if (!groups.length && !later.length)
    return (
      <Empty emoji="🗓️" title="Nic zaplanowanego na kolejne dni">
        Możesz nadać zadaniom termin — albo cieszyć się wolną głową.
      </Empty>
    )
  return (
    <div>
      {groups.map((g) => (
        <Section key={g.day} title={`${humanDay(g.day)}${humanDay(g.day) === weekdayName(g.day) ? '' : ` · ${weekdayName(g.day)}`}`} count={g.tasks.length}>
          <TaskList tasks={g.tasks} showDue={false} />
        </Section>
      ))}
      {later.length > 0 && (
        <Section title="Później" count={later.length} collapsible defaultOpen={false}>
          <TaskList tasks={later} />
        </Section>
      )}
    </div>
  )
}

function All({ tasks }: { tasks: ReturnType<typeof openTasks> }) {
  const td = today()
  const open = openTasks(tasks).sort((a, b) => sortOpen(a, b, td))
  if (!open.length)
    return (
      <Empty emoji="✨" title="Brak otwartych zadań">
        Wszystko ogarnięte. Albo jeszcze nic nie dodane — i tak też jest dobrze.
      </Empty>
    )
  const noDate = open.filter((t) => !t.due)
  const withDate = open.filter((t) => t.due)
  return (
    <div>
      {withDate.length > 0 && (
        <Section title="Z terminem" count={withDate.length}>
          <TaskList tasks={withDate} limit={7} />
        </Section>
      )}
      {noDate.length > 0 && (
        <Section title="Bez terminu" count={noDate.length}>
          <TaskList tasks={noDate} limit={7} />
        </Section>
      )}
    </div>
  )
}

function Done({ tasks }: { tasks: ReturnType<typeof openTasks> }) {
  const done = doneTasks(tasks)
  if (!done.length)
    return (
      <Empty emoji="🫙" title="Tu pojawią się twoje sukcesy">
        Każde ukończone zadanie ląduje tutaj — dowód, że działasz.
      </Empty>
    )
  return <TaskList tasks={done} limit={30} />
}
