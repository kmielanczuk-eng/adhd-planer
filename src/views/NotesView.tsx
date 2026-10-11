import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useNotes, useTasks } from '../lib/hooks'
import { createNote, restoreNote, updateNote } from '../lib/actions'
import { navigate, useRoute } from '../lib/router'
import { plainPreview, renderMarkdown, toggleCheckboxLine } from '../lib/markdown'
import { humanDay } from '../lib/dates'
import { dayOf } from '../lib/selectors'
import { openTask, toast } from '../lib/ui'
import { rewardXp } from '../lib/flows'
import { Icon, type IconName } from '../components/Icon'
import { Button, Empty, IconButton } from '../components/ui'

export function NotesView() {
  const route = useRoute()
  const id = route.parts[1]
  if (id) return <NoteEditor id={id} />
  return <NotesList />
}

function NotesList() {
  const notes = useNotes()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return notes
      .filter((n) => !query || n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query) || n.tags.some((t) => t.includes(query)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [notes, q])

  const add = async () => {
    const n = await createNote()
    navigate('/notatki/' + n.id)
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-3 mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Notatki</h1>
        <Button variant="primary" icon="plus" onClick={() => void add()} data-testid="new-note">
          Nowa
        </Button>
      </header>
      <label className="relative block mb-4">
        <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj w notatkach…"
          aria-label="Szukaj w notatkach"
          className="w-full min-h-12 rounded-2xl bg-surface border border-line pl-10 pr-3 outline-none focus:ring-2 focus:ring-accent/40"
        />
      </label>
      {list.length === 0 ? (
        notes.length === 0 ? (
          <Empty emoji="📝" title="Brak notatek">
            Pomysły, listy zakupów, rzeczy do zapamiętania. Pisz krótko — tu nic nie musi być idealne.
          </Empty>
        ) : (
          <Empty emoji="🔎" title="Nic nie znaleziono" />
        )
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {list.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => navigate('/notatki/' + n.id)}
              className="text-left rounded-2xl bg-surface border border-line/70 p-4 hover:border-accent/40 transition anim-pop min-h-24"
            >
              <div className="font-semibold leading-snug flex items-center gap-1.5">
                {n.pinned && <Icon name="pin" size={14} className="text-sun shrink-0" />}
                <span className="truncate">{n.title || plainPreview(n.body, 40) || 'Bez tytułu'}</span>
              </div>
              <p className="text-sm text-muted mt-1 line-clamp-3">{plainPreview(n.body) || ' '}</p>
              <p className="text-xs text-muted mt-2">{humanDay(dayOf(n.updatedAt))}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteEditor({ id }: { id: string }) {
  const note = useLiveQuery(() => db.notes.get(id), [id])
  const tasks = useTasks()
  const [title, setTitle] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<{ title?: string; body?: string }>({})
  const rewarded = useRef(false)

  useEffect(() => {
    if (note && title == null) {
      setTitle(note.title)
      setBody(note.body)
      setPreview(note.body.length > 0)
    }
  }, [note, title])

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    const p = pending.current
    pending.current = {}
    if (Object.keys(p).length) void updateNote(id, p)
  }
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const queue = (patch: { title?: string; body?: string }) => {
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 400)
    if (!rewarded.current && (patch.body?.length ?? 0) > 20) {
      rewarded.current = true
      void rewardXp('note', 'Notatka')
    }
  }

  if (note === undefined) return null
  if (!note || note.deleted)
    return (
      <Empty emoji="🫥" title="Tej notatki już nie ma">
        <Button className="mt-3" onClick={() => navigate('/notatki')}>
          Wróć do notatek
        </Button>
      </Empty>
    )

  const linked = tasks.find((t) => t.id === note.taskId || t.noteId === note.id)

  const wrap = (before: string, after = before, linePrefix = false) => {
    const el = ta.current
    if (!el || body == null) return
    const { selectionStart: s, selectionEnd: e } = el
    let next: string
    let cursor: number
    if (linePrefix) {
      const lineStart = body.lastIndexOf('\n', s - 1) + 1
      next = body.slice(0, lineStart) + before + body.slice(lineStart)
      cursor = e + before.length
    } else {
      const sel = body.slice(s, e) || 'tekst'
      next = body.slice(0, s) + before + sel + after + body.slice(e)
      cursor = s + before.length + sel.length + after.length
    }
    setBody(next)
    queue({ body: next })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const tools: Array<[IconName, string, () => void]> = [
    ['bold', 'Pogrubienie', () => wrap('**')],
    ['italic', 'Kursywa', () => wrap('*')],
    ['heading', 'Nagłówek', () => wrap('## ', '', true)],
    ['listBullet', 'Lista', () => wrap('- ', '', true)],
    ['checkSquare', 'Checkbox', () => wrap('- [ ] ', '', true)],
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-3 -ml-2">
        <button type="button" onClick={() => { flush(); navigate('/notatki') }} className="inline-flex items-center gap-1 text-muted hover:text-ink min-h-11 px-2">
          <Icon name="chevronLeft" size={18} /> Notatki
        </button>
        <div className="flex items-center gap-1">
          <IconButton icon="pin" label={note.pinned ? 'Odepnij' : 'Przypnij na górze'} className={note.pinned ? 'text-sun' : ''} onClick={() => void updateNote(id, { pinned: !note.pinned })} />
          <IconButton
            icon="trash"
            label="Usuń notatkę"
            onClick={async () => {
              flush()
              const snap = await db.notes.get(id)
              await updateNote(id, { deleted: 1 })
              navigate('/notatki')
              if (snap) toast('Notatka usunięta', { undo: () => restoreNote(snap) })
            }}
          />
        </div>
      </div>
      <input
        value={title ?? ''}
        onChange={(e) => {
          setTitle(e.target.value)
          queue({ title: e.target.value })
        }}
        placeholder="Tytuł"
        aria-label="Tytuł notatki"
        className="w-full bg-transparent text-2xl font-bold outline-none mb-2"
      />
      {linked && (
        <button type="button" onClick={() => openTask(linked.id)} className="mb-3 inline-flex items-center gap-1.5 text-sm rounded-full bg-accent-soft text-accent px-3 min-h-9">
          <Icon name="link" size={14} /> {linked.title}
        </button>
      )}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {!preview &&
          tools.map(([icon, label, fn]) => (
            <IconButton key={label} icon={icon} label={label} onClick={fn} size={18} className="!min-w-10 !min-h-10" />
          ))}
        <div className="flex-1" />
        <Button size="sm" variant="soft" icon={preview ? 'edit' : 'eye'} onClick={() => setPreview(!preview)}>
          {preview ? 'Edytuj' : 'Podgląd'}
        </Button>
      </div>
      {preview ? (
        <div
          className="prose-note min-h-[50dvh] rounded-2xl bg-surface border border-line/70 p-4 cursor-text"
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target instanceof HTMLInputElement && target.type === 'checkbox') {
              const line = Number(target.dataset.line)
              const next = toggleCheckboxLine(body ?? '', line)
              setBody(next)
              queue({ body: next })
              return
            }
            if (target.closest('a')) return
            setPreview(false)
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body ?? '') || '<p style="opacity:.6">Pusto. Stuknij, żeby pisać.</p>' }}
        />
      ) : (
        <textarea
          ref={ta}
          value={body ?? ''}
          autoFocus={!note.body}
          onChange={(e) => {
            setBody(e.target.value)
            queue({ body: e.target.value })
          }}
          onBlur={flush}
          placeholder={'Pisz śmiało…\n\n**pogrubienie**, *kursywa*, ## nagłówek, - lista, - [ ] do odhaczenia'}
          aria-label="Treść notatki"
          className="w-full min-h-[50dvh] rounded-2xl bg-surface border border-line/70 p-4 outline-none focus:ring-2 focus:ring-accent/40 leading-relaxed"
        />
      )}
      <p className="text-xs text-muted mt-2">Zapisuje się samo.</p>
    </div>
  )
}
