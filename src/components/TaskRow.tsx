import { useRef, useState } from 'react'
import type { Task } from '../lib/types'
import { formatMinutes, humanDay, today } from '../lib/dates'
import { completeWithJoy } from '../lib/flows'
import { openTask } from '../lib/ui'
import { uncompleteTask } from '../lib/actions'
import { Icon } from './Icon'
import { Badge } from './ui'

export const ENERGY_LABEL = { low: 'Mało energii', medium: 'Średnio energii', high: 'Dużo energii' } as const
export const ENERGY_SHORT = { low: 'niska', medium: 'średnia', high: 'wysoka' } as const
export const ENERGY_EMOJI = { low: '🪫', medium: '🔋', high: '⚡' } as const

export function CheckCircle({ done, onClick, label }: { done: boolean; onClick: (el: HTMLElement) => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [pop, setPop] = useState(false)
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        setPop(true)
        setTimeout(() => setPop(false), 400)
        onClick(ref.current!)
      }}
      className="shrink-0 grid place-items-center w-11 h-11 -m-1.5 rounded-full"
    >
      <span
        className={`grid place-items-center w-7 h-7 rounded-full border-2 transition ${pop ? 'anim-check' : ''} ${
          done ? 'bg-accent border-accent text-accent-ink' : 'border-muted/50 hover:border-accent hover:bg-accent-soft'
        }`}
      >
        {done && <Icon name="check" size={16} strokeWidth={3} />}
      </span>
    </button>
  )
}

export function TaskMeta({ task, showDue = true }: { task: Task; showDue?: boolean }) {
  const td = today()
  const stepsDone = task.steps.filter((s) => s.done).length
  const items: React.ReactNode[] = []
  if (showDue && task.due) {
    const past = task.due < td
    items.push(
      <Badge key="due" tone={past ? 'sun' : task.due === td ? 'accent' : 'muted'}>
        <Icon name="calendar" size={12} />
        {past ? `z: ${humanDay(task.due)}` : humanDay(task.due)}
      </Badge>,
    )
  }
  if (task.estimate) {
    items.push(
      <Badge key="est" tone="sky">
        <Icon name="clock" size={12} />
        {formatMinutes(task.estimate)}
      </Badge>,
    )
  }
  if (task.energy) items.push(<Badge key="en" tone="lav">{ENERGY_EMOJI[task.energy]} {ENERGY_SHORT[task.energy]}</Badge>)
  if (task.steps.length) {
    items.push(
      <Badge key="steps" tone={stepsDone === task.steps.length ? 'accent' : 'muted'}>
        <Icon name="list" size={12} />
        {stepsDone}/{task.steps.length}
      </Badge>,
    )
  }
  if (task.remindAt && new Date(task.remindAt).getTime() > Date.now()) items.push(<Badge key="rem"><Icon name="bell" size={12} /></Badge>)
  if (task.project) items.push(<Badge key="proj" tone="muted"><Icon name="folder" size={12} />{task.project}</Badge>)
  task.tags.slice(0, 3).forEach((t) => items.push(<Badge key={'t' + t}>#{t}</Badge>))
  if (!items.length) return null
  return <div className="flex flex-wrap gap-1.5 mt-1">{items}</div>
}

export function TaskRow({ task, showDue = true, compact }: { task: Task; showDue?: boolean; compact?: boolean }) {
  const done = task.status === 'done'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openTask(task.id)
      }}
      data-testid="task-row"
      className={`group flex items-start gap-3 rounded-2xl bg-surface border border-line/70 px-3.5 ${compact ? 'py-2.5' : 'py-3'} hover:border-accent/40 transition anim-pop`}
    >
      <div className="pt-0.5">
        <CheckCircle
          done={done}
          label={done ? `Cofnij ukończenie: ${task.title}` : `Ukończ: ${task.title}`}
          onClick={(el) => (done ? void uncompleteTask(task.id) : void completeWithJoy(task.id, el))}
        />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className={`leading-snug break-words ${done ? 'line-through text-muted' : ''}`}>
          {task.pinnedFor === today() && !done && <span className="mr-1" title="Na dziś">⭐</span>}
          {task.title || <span className="text-muted italic">Bez tytułu</span>}
        </div>
        {!compact && <TaskMeta task={task} showDue={showDue} />}
      </div>
    </div>
  )
}

export function TaskList({ tasks, showDue = true, limit, emptyText }: { tasks: Task[]; showDue?: boolean; limit?: number; emptyText?: string }) {
  const [expanded, setExpanded] = useState(false)
  const shown = limit && !expanded ? tasks.slice(0, limit) : tasks
  if (!tasks.length && emptyText) return <p className="text-muted text-sm px-1">{emptyText}</p>
  return (
    <div className="flex flex-col gap-2">
      {shown.map((t) => (
        <TaskRow key={t.id} task={t} showDue={showDue} />
      ))}
      {limit && tasks.length > limit && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm text-muted hover:text-ink min-h-10 self-start px-2">
          {expanded ? 'Pokaż mniej' : `Pokaż jeszcze ${tasks.length - limit}`}
        </button>
      )}
    </div>
  )
}
