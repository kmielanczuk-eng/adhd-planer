import { useEffect, useMemo, useRef, useState } from 'react'
import { useTask, useNotes, useTasks } from '../lib/hooks'
import { openTask, startFocus, toast, useUI } from '../lib/ui'
import { createNote, updateTask } from '../lib/actions'
import { addDays, dayKey, formatMinutes, humanDateTime, humanDay, nextWeekend, today } from '../lib/dates'
import { completeWithJoy, deleteTaskWithUndo, toggleStepWithJoy } from '../lib/flows'
import { uid } from '../lib/db'
import type { Energy, Task } from '../lib/types'
import { AiError, breakDownTask, estimateTask, hasAiKey } from '../lib/ai'
import { allProjects, allTags } from '../lib/selectors'
import { navigate } from '../lib/router'
import { Icon } from './Icon'
import { Button, Chip, Sheet } from './ui'
import { ENERGY_EMOJI, ENERGY_LABEL } from './TaskRow'

const ESTIMATES = [5, 15, 30, 60, 120]

export function TaskDetailHost() {
  const id = useUI((s) => s.taskId)
  const task = useTask(id)
  const close = () => openTask(null)
  return (
    <Sheet open={!!id && !!task} onClose={close} wide labelledBy="task-detail-title">
      {task && <TaskDetail key={task.id} task={task} onClose={close} />}
    </Sheet>
  )
}

function useDebounced(fn: (v: string) => void, ms = 350) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current)
      if (latest.current != null) fn(latest.current)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return (v: string) => {
    latest.current = v
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => {
      fn(v)
      latest.current = null
    }, ms)
  }
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const td = today()
  const [title, setTitle] = useState(task.title)
  const [details, setDetails] = useState(task.details)
  const [newStep, setNewStep] = useState('')
  const [aiBusy, setAiBusy] = useState<null | 'split' | 'estimate'>(null)
  const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [more, setMore] = useState(Boolean(task.details || task.tags.length || task.project || task.remindAt || task.noteId))
  const tasks = useTasks()
  const notes = useNotes()
  const tags = useMemo(() => allTags(tasks), [tasks])
  const projects = useMemo(() => allProjects(tasks), [tasks])
  const saveTitle = useDebounced((v) => void updateTask(task.id, { title: v }))
  const saveDetails = useDebounced((v) => void updateTask(task.id, { details: v }))
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title])

  const set = (patch: Partial<Task>) => void updateTask(task.id, patch)
  const isInbox = task.status === 'inbox'
  const done = task.status === 'done'
  const pinned = task.pinnedFor === td

  const addStep = () => {
    const titles = newStep
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!titles.length) return
    set({ steps: [...task.steps, ...titles.map((t) => ({ id: uid(), title: t, done: false }))] })
    setNewStep('')
  }

  const aiSplit = async () => {
    if (!hasAiKey()) {
      setAiMsg('Żeby AI rozbijało zadania, wklej swój klucz API Anthropic w Ustawieniach → AI. Klucz zostaje tylko na tym urządzeniu.')
      return
    }
    setAiBusy('split')
    setAiMsg(null)
    try {
      const r = await breakDownTask(title, details, task.steps.map((s) => s.title))
      const steps = [...task.steps, ...r.steps.map((s) => ({ id: uid(), title: `${s.title}`, done: false }))]
      set({ steps, estimate: task.estimate ?? r.totalMinutes })
      setAiMsg(`✨ ${r.tip}`)
    } catch (e) {
      setAiMsg(e instanceof AiError ? e.message : 'Nie udało się. Spróbuj ponownie.')
    } finally {
      setAiBusy(null)
    }
  }

  const aiEstimate = async () => {
    if (!hasAiKey()) {
      setAiMsg('Żeby AI szacowało czas, wklej swój klucz API Anthropic w Ustawieniach → AI.')
      return
    }
    setAiBusy('estimate')
    setAiMsg(null)
    try {
      const r = await estimateTask(title, details, task.steps.map((s) => s.title))
      set({ estimate: r.minutes, energy: task.energy ?? r.energy })
      setAiMsg(`⏱️ ok. ${formatMinutes(r.minutes)} — ${r.reason}`)
    } catch (e) {
      setAiMsg(e instanceof AiError ? e.message : 'Nie udało się. Spróbuj ponownie.')
    } finally {
      setAiBusy(null)
    }
  }

  const setReminder = (d: Date | null) => {
    set({ remindAt: d ? d.toISOString() : null })
    if (d) toast(`Przypomnę: ${humanDateTime(d.toISOString())}`, { tone: 'info' })
  }

  const reminderPresets = () => {
    const n = new Date()
    const inHour = new Date(n.getTime() + 60 * 60 * 1000)
    const evening = new Date(n)
    evening.setHours(19, 0, 0, 0)
    const tomorrow = new Date(n)
    tomorrow.setDate(n.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const list: Array<[string, Date]> = [['Za godzinę', inHour]]
    if (evening > n) list.push(['Dziś o 19:00', evening])
    list.push(['Jutro o 9:00', tomorrow])
    return list
  }

  const linkedNote = notes.find((n) => n.id === task.noteId)

  return (
    <div className="px-5 pb-6 pt-3 sm:pt-5">
      <div className="flex items-start gap-2">
        <textarea
          ref={titleRef}
          id="task-detail-title"
          value={title}
          rows={1}
          onChange={(e) => {
            setTitle(e.target.value)
            saveTitle(e.target.value)
          }}
          placeholder="Co jest do zrobienia?"
          aria-label="Tytuł zadania"
          className="flex-1 resize-none bg-transparent text-xl font-semibold leading-snug outline-none py-1.5 overflow-hidden"
        />
        <button type="button" onClick={onClose} className="min-w-11 min-h-11 grid place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Zamknij">
          <Icon name="x" />
        </button>
      </div>

      {isInbox && (
        <div className="mt-2 rounded-2xl bg-sky-soft p-3 text-sm flex items-center justify-between gap-2">
          <span>To jest w Inboxie.</span>
          <Button size="sm" variant="primary" onClick={() => set({ status: 'open' })}>
            Zrób z tego zadanie
          </Button>
        </div>
      )}

      {/* Najważniejsze akcje */}
      <div className="flex flex-wrap gap-2 mt-4">
        {!done ? (
          <Button variant="primary" icon="check" onClick={(e) => { void completeWithJoy(task.id, e.currentTarget); onClose() }}>
            Zrobione
          </Button>
        ) : (
          <Button icon="undo" onClick={() => set({ status: 'open', completedAt: null })}>
            Przywróć
          </Button>
        )}
        {!done && (
          <Button
            icon="play"
            onClick={() => {
              startFocus({ taskId: task.id, title: task.title, minutes: 5, starter: true })
              onClose()
            }}
          >
            Tylko 5 minut
          </Button>
        )}
        {!done && (
          <Button variant={pinned ? 'primary' : 'outline'} onClick={() => set({ pinnedFor: pinned ? null : td, status: task.status === 'inbox' ? 'open' : task.status })}>
            {pinned ? '⭐ Na dziś' : '☆ Na dziś'}
          </Button>
        )}
      </div>

      {/* Termin */}
      <Field label="Kiedy?" icon="calendar">
        <div className="flex flex-wrap gap-2">
          <Chip active={task.due === td} onClick={() => set({ due: task.due === td ? null : td })}>Dziś</Chip>
          <Chip active={task.due === addDays(td, 1)} onClick={() => set({ due: addDays(td, 1) })}>Jutro</Chip>
          <Chip active={task.due === nextWeekend(td) && task.due !== td} onClick={() => set({ due: nextWeekend(td) })}>Weekend</Chip>
          <Chip active={task.due === addDays(td, 7)} onClick={() => set({ due: addDays(td, 7) })}>Za tydzień</Chip>
          <label className="relative min-h-10 px-3.5 rounded-full border border-line bg-surface text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-surface-2">
            <Icon name="calendar" size={14} />
            {task.due && ![td, addDays(td, 1), nextWeekend(td), addDays(td, 7)].includes(task.due) ? humanDay(task.due) : 'Data…'}
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer"
              value={task.due ?? ''}
              onChange={(e) => set({ due: e.target.value || null })}
              aria-label="Wybierz datę"
            />
          </label>
          {task.due && (
            <Chip onClick={() => set({ due: null })}>
              Bez terminu
            </Chip>
          )}
        </div>
      </Field>

      {/* Czas i energia */}
      <Field label="Ile to zajmie?" icon="clock">
        <div className="flex flex-wrap gap-2">
          {ESTIMATES.map((m) => (
            <Chip key={m} tone="lav" active={task.estimate === m} onClick={() => set({ estimate: task.estimate === m ? null : m })}>
              {formatMinutes(m)}
            </Chip>
          ))}
          {task.estimate && !ESTIMATES.includes(task.estimate) && <Chip tone="lav" active onClick={() => set({ estimate: null })}>{formatMinutes(task.estimate)}</Chip>}
          <Chip onClick={() => void aiEstimate()}>
            <span className="inline-flex items-center gap-1">
              <Icon name="sparkles" size={14} /> {aiBusy === 'estimate' ? 'Szacuję…' : 'Oszacuj (AI)'}
            </span>
          </Chip>
        </div>
      </Field>

      <Field label="Ile energii to wymaga?" icon="bolt">
        <div className="flex flex-wrap gap-2">
          {(['low', 'medium', 'high'] as Energy[]).map((e) => (
            <Chip key={e} tone="sun" active={task.energy === e} onClick={() => set({ energy: task.energy === e ? null : e })}>
              {ENERGY_EMOJI[e]} {ENERGY_LABEL[e]}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Kroki */}
      <Field label={`Małe kroki${task.steps.length ? ` (${task.steps.filter((s) => s.done).length}/${task.steps.length})` : ''}`} icon="list">
        <div className="flex flex-col gap-1">
          {task.steps.map((s, i) => (
            <div key={s.id} className="group flex items-center gap-2 rounded-xl hover:bg-surface-2 pr-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                aria-label={`Krok: ${s.title}`}
                onClick={() => void toggleStepWithJoy(task.id, s.id)}
                className="grid place-items-center w-11 h-11 shrink-0"
              >
                <span className={`grid place-items-center w-6 h-6 rounded-lg border-2 transition ${s.done ? 'bg-accent border-accent text-accent-ink' : 'border-muted/50'}`}>
                  {s.done && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
              </button>
              <input
                className={`flex-1 bg-transparent outline-none py-2 min-w-0 ${s.done ? 'line-through text-muted' : ''}`}
                defaultValue={s.title}
                aria-label={`Treść kroku ${i + 1}`}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v !== s.title) set({ steps: task.steps.map((x) => (x.id === s.id ? { ...x, title: v || x.title } : x)) })
                }}
              />
              <button
                type="button"
                aria-label="Usuń krok"
                onClick={() => {
                  const prev = task.steps
                  set({ steps: task.steps.filter((x) => x.id !== s.id) })
                  toast('Usunięto krok', { undo: () => updateTask(task.id, { steps: prev }) })
                }}
                className="min-w-10 min-h-10 grid place-items-center rounded-full text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-peach"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addStep()
                }
              }}
              placeholder="+ Dodaj krok"
              aria-label="Nowy krok"
              className="flex-1 min-h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent/40"
            />
            {newStep.trim() && (
              <Button size="sm" onClick={addStep}>
                Dodaj
              </Button>
            )}
          </div>
          <Button className="mt-2 self-start" variant="outline" icon="sparkles" disabled={aiBusy === 'split'} onClick={() => void aiSplit()}>
            {aiBusy === 'split' ? 'Rozbijam na kroczki…' : 'Rozbij to na małe kroki (AI)'}
          </Button>
          {aiMsg && (
            <p className="text-sm mt-2 rounded-xl bg-lav-soft px-3 py-2" role="status">
              {aiMsg}
              {!hasAiKey() && (
                <button
                  type="button"
                  className="ml-1 underline"
                  onClick={() => {
                    onClose()
                    navigate('/ustawienia')
                  }}
                >
                  Otwórz Ustawienia
                </button>
              )}
            </p>
          )}
        </div>
      </Field>

      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="mt-5 text-sm text-muted hover:text-ink inline-flex items-center gap-1 min-h-10">
          <Icon name="chevronDown" size={16} /> Więcej: notatka, tagi, projekt, przypomnienie
        </button>
      ) : (
        <>
          <Field label="Przypomnienie" icon="bell">
            <div className="flex flex-wrap gap-2">
              {reminderPresets().map(([label, d]) => (
                <Chip key={label} onClick={() => setReminder(d)}>
                  {label}
                </Chip>
              ))}
              <label className="relative min-h-10 px-3.5 rounded-full border border-line bg-surface text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-surface-2">
                Inna godzina…
                <input
                  type="datetime-local"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => e.target.value && setReminder(new Date(e.target.value))}
                  aria-label="Wybierz datę i godzinę przypomnienia"
                />
              </label>
            </div>
            {task.remindAt && (
              <div className="mt-2 text-sm flex items-center gap-2">
                <Icon name="bell" size={14} />
                {new Date(task.remindAt).getTime() > Date.now() ? `Przypomnę: ${humanDateTime(task.remindAt)}` : `Przypomnienie było: ${humanDateTime(task.remindAt)}`}
                <button type="button" className="underline text-muted" onClick={() => setReminder(null)}>
                  usuń
                </button>
              </div>
            )}
          </Field>

          <Field label="Notatki do zadania" icon="note">
            <textarea
              value={details}
              onChange={(e) => {
                setDetails(e.target.value)
                saveDetails(e.target.value)
              }}
              rows={3}
              placeholder="Szczegóły, linki, cokolwiek…"
              className="w-full rounded-2xl bg-surface-2 px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {linkedNote ? (
                <>
                  <button type="button" className="inline-flex items-center gap-1.5 underline" onClick={() => { onClose(); navigate('/notatki/' + linkedNote.id) }}>
                    <Icon name="link" size={14} /> {linkedNote.title || 'Notatka bez tytułu'}
                  </button>
                  <button type="button" className="text-muted underline" onClick={() => set({ noteId: null })}>
                    odepnij
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="min-h-10 rounded-xl bg-surface-2 px-2 max-w-[60vw]"
                    value=""
                    aria-label="Podepnij notatkę"
                    onChange={(e) => e.target.value && set({ noteId: e.target.value })}
                  >
                    <option value="">Podepnij notatkę…</option>
                    {notes
                      .slice()
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || n.body.slice(0, 40) || 'Bez tytułu'}
                        </option>
                      ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="plus"
                    onClick={async () => {
                      const n = await createNote({ title: task.title, taskId: task.id })
                      set({ noteId: n.id })
                      onClose()
                      navigate('/notatki/' + n.id)
                    }}
                  >
                    Nowa notatka
                  </Button>
                </>
              )}
            </div>
          </Field>

          <Field label="Tagi i projekt" icon="tag">
            <TagEditor value={task.tags} suggestions={tags} onChange={(t) => set({ tags: t })} />
            <input
              list="projects-list"
              defaultValue={task.project ?? ''}
              onBlur={(e) => set({ project: e.target.value.trim() || null })}
              placeholder="Projekt (np. Dom, Praca)"
              aria-label="Projekt"
              className="mt-2 w-full min-h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent/40"
            />
            <datalist id="projects-list">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      <div className="flex justify-between items-center mt-8 pt-4 border-t border-line">
        <p className="text-xs text-muted">Dodane {humanDay(dayKey(new Date(task.createdAt)))}</p>
        <Button
          variant="danger"
          size="sm"
          icon="trash"
          onClick={() => {
            void deleteTaskWithUndo(task.id)
            onClose()
          }}
        >
          Usuń
        </Button>
      </div>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon: Parameters<typeof Icon>[0]['name']; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-muted mb-2">
        <Icon name={icon} size={15} />
        {label}
      </div>
      {children}
    </div>
  )
}

function TagEditor({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').toLowerCase()
    if (!t || value.includes(t)) return
    onChange([...value, t])
  }
  const unused = suggestions.filter((s) => !value.includes(s) && (!input || s.includes(input.toLowerCase()))).slice(0, 6)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {value.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent px-3 min-h-9 text-sm"
            aria-label={`Usuń tag ${t}`}
          >
            #{t} <Icon name="x" size={12} />
          </button>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
              e.preventDefault()
              add(input)
              setInput('')
            }
          }}
          onBlur={() => {
            if (input) {
              add(input)
              setInput('')
            }
          }}
          placeholder="+ tag"
          aria-label="Dodaj tag"
          className="min-h-9 w-28 rounded-full bg-surface-2 px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-line px-2.5 min-h-8 text-xs text-muted hover:text-ink">
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
