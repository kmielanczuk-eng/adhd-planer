import { useMemo, useRef, useState } from 'react'
import { useTasksLoaded } from '../lib/hooks'
import { inboxTasks } from '../lib/selectors'
import { revokeLatestXp, triageToNote, triageToTask, updateTask } from '../lib/actions'
import { db, now, notifyLocalChange } from '../lib/db'
import { openDump, openTask, toast } from '../lib/ui'
import { today } from '../lib/dates'
import { playSound, vibrate } from '../lib/feedback'
import { Icon } from '../components/Icon'
import { Button, Empty } from '../components/ui'
import type { Task } from '../lib/types'

export function InboxView() {
  const loaded = useTasksLoaded()
  const items = useMemo(() => inboxTasks(loaded ?? []), [loaded])
  if (!loaded) return null
  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Inbox</h1>
          <p className="text-muted mt-1 text-sm">
            {items.length ? 'Zdecyduj szybko: zadanie, notatka czy kosz. Nie musisz wszystkiego naraz.' : 'Tu lądują wszystkie zrzuty myśli.'}
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={openDump} className="shrink-0 hidden sm:inline-flex">
          <span className="hidden sm:inline">Zrzut myśli</span>
        </Button>
      </header>
      {items.length > 0 && (
        <p className="text-xs text-muted mb-3 flex items-center gap-1.5 sm:hidden">
          <Icon name="arrowRight" size={14} /> przesuń w prawo = zadanie · w lewo = kosz
        </p>
      )}
      {items.length === 0 ? (
        <Empty emoji="📭" title="Inbox pusty — głowa lżejsza">
          Masz coś na myśli? Naciśnij „+” (albo klawisz N) i wyrzuć to tutaj. Bez porządkowania, bez pól do wypełnienia.
        </Empty>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((t) => (
            <InboxCard key={t.id} task={t} />
          ))}
          {items.length > 3 && <BulkTriage items={items} />}
        </div>
      )}
    </div>
  )
}

function BulkTriage({ items }: { items: Task[] }) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        className="text-sm text-muted underline min-h-10"
        onClick={async () => {
          const ids = items.map((t) => t.id)
          for (const id of ids) await updateTask(id, { status: 'open' })
          toast(`Przeniesiono ${ids.length} do zadań`, {
            undo: async () => {
              for (const id of ids) await updateTask(id, { status: 'inbox' })
            },
          })
        }}
      >
        Wszystko to zadania — przenieś hurtem
      </button>
    </div>
  )
}

async function toTask(task: Task, patch: Partial<Task> = {}) {
  await triageToTask(task.id, patch)
  playSound('step')
  vibrate(10)
  toast(patch.due ? 'Zadanie na dziś ✔' : 'Przeniesione do zadań', {
    undo: async () => {
      await updateTask(task.id, { status: 'inbox', due: task.due, pinnedFor: task.pinnedFor })
      await revokeLatestXp('triage')
    },
  })
}

async function toNote(task: Task) {
  const noteId = await triageToNote(task.id)
  playSound('step')
  toast('Zapisane jako notatka', {
    undo: async () => {
      if (noteId) await db.notes.update(noteId, { deleted: 1, dirty: 1, updatedAt: now() })
      await updateTask(task.id, { deleted: 0 })
      await revokeLatestXp('triage')
      notifyLocalChange()
    },
  })
}

async function toTrash(task: Task) {
  await updateTask(task.id, { deleted: 1 })
  toast('Wyrzucone', { undo: () => updateTask(task.id, { deleted: 0 }) })
}

function InboxCard({ task }: { task: Task }) {
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0)
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null)
  const THRESH = 90

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (s.locked == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.locked = Math.abs(mx) > Math.abs(my)
      if (s.locked) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (s.locked) setDx(mx)
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    if (!s?.locked) {
      setDx(0)
      return
    }
    if (dx > THRESH) {
      setLeaving(1)
      setTimeout(() => void toTask(task), 160)
    } else if (dx < -THRESH) {
      setLeaving(-1)
      setTimeout(() => void toTrash(task), 160)
    } else setDx(0)
  }

  const offset = leaving ? leaving * 600 : dx
  const bg = dx > 20 ? 'bg-accent-soft' : dx < -20 ? 'bg-peach-soft' : 'bg-transparent'

  return (
    <div className={`relative rounded-2xl overflow-hidden ${bg} transition-colors`} data-testid="inbox-item">
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none text-sm font-semibold">
        <span className={`text-accent flex items-center gap-1 ${dx > 20 ? 'opacity-100' : 'opacity-0'}`}>
          <Icon name="check" size={18} /> Zadanie
        </span>
        <span className={`text-peach flex items-center gap-1 ${dx < -20 ? 'opacity-100' : 'opacity-0'}`}>
          Kosz <Icon name="trash" size={18} />
        </span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)`, transition: start.current ? 'none' : 'transform 0.18s ease-out', touchAction: 'pan-y' }}
        className="relative bg-surface border border-line/70 rounded-2xl p-3.5 select-none"
      >
        <button type="button" className="block w-full text-left leading-snug break-words min-h-8" onClick={() => openTask(task.id)}>
          {task.title}
        </button>
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <TriageBtn icon="check" label="Zadanie" tone="accent" onClick={() => void toTask(task)} testid="triage-task" />
          <TriageBtn icon="star" label="Na dziś" tone="sun" onClick={() => void toTask(task, { due: today(), pinnedFor: null })} testid="triage-today" />
          <TriageBtn icon="note" label="Notatka" tone="lav" onClick={() => void toNote(task)} testid="triage-note" />
          <TriageBtn icon="trash" label="Kosz" tone="peach" onClick={() => void toTrash(task)} testid="triage-trash" />
        </div>
      </div>
    </div>
  )
}

function TriageBtn({ icon, label, tone, onClick, testid }: { icon: Parameters<typeof Icon>[0]['name']; label: string; tone: 'accent' | 'sun' | 'lav' | 'peach'; onClick: () => void; testid: string }) {
  const t = { accent: 'bg-accent-soft text-accent', sun: 'bg-sun-soft text-sun', lav: 'bg-lav-soft text-lav', peach: 'bg-peach-soft text-peach' }[tone]
  return (
    <button type="button" onClick={onClick} data-testid={testid} className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 rounded-xl px-1 py-1.5 min-h-12 sm:min-h-10 text-xs sm:text-sm font-medium active:scale-95 transition ${t}`}>
      <Icon name={icon} size={17} /> {label}
    </button>
  )
}
