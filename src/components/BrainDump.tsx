import { useEffect, useRef, useState } from 'react'
import { brainDump } from '../lib/actions'
import { db, now, notifyLocalChange } from '../lib/db'
import { playSound, vibrate } from '../lib/feedback'
import { closeDump, pulseXp, toast, useUI } from '../lib/ui'
import { Icon } from './Icon'

/** Szybki zrzut myśli: jedno pole, Enter zapisuje, okno zostaje otwarte na kolejną myśl. */
export function BrainDump() {
  const open = useUI((s) => s.dumpOpen)
  const [text, setText] = useState('')
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setCount(0)
      // focus natychmiast (iOS wymaga focusu w tym samym ticku co gest — próbujemy od razu i po klatce)
      ref.current?.focus()
      requestAnimationFrame(() => ref.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDump()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const save = async () => {
    const value = text
    if (!value.trim()) {
      closeDump()
      return
    }
    setText('')
    const ids = await brainDump(value)
    setCount((c) => c + ids.length)
    playSound('dump')
    vibrate(10)
    pulseXp(Math.min(ids.length, 5))
    toast(ids.length > 1 ? `Zapisano ${ids.length} myśli w Inboxie` : 'Zapisane w Inboxie', {
      undo: async () => {
        await db.transaction('rw', db.tasks, async () => {
          for (const id of ids) await db.tasks.update(id, { deleted: 1, dirty: 1, updatedAt: now() })
        })
        notifyLocalChange()
      },
    })
    ref.current?.focus()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Zrzut myśli">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 anim-fade" onClick={closeDump} />
      <div className="relative w-full max-w-xl mt-[max(env(safe-area-inset-top),1rem)] sm:mt-0 rounded-3xl bg-surface shadow-2xl p-4 anim-pop">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <span aria-hidden>🧠</span> Wyrzuć to z głowy
            {count > 0 && <span className="text-accent">· zapisano {count}</span>}
          </div>
          <button type="button" onClick={closeDump} className="min-w-11 min-h-11 grid place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Zamknij">
            <Icon name="x" />
          </button>
        </div>
        <textarea
          ref={ref}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void save()
            }
          }}
          rows={3}
          placeholder="Co ci chodzi po głowie? Zadanie, pomysł, cokolwiek…"
          className="w-full resize-none rounded-2xl bg-surface-2 px-4 py-3 text-lg outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent/40"
          aria-label="Treść myśli"
          data-testid="dump-input"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-xs text-muted px-1 hidden sm:block">Enter — zapisz · Shift+Enter — nowa linia · każda linia = osobny wpis</p>
          <p className="text-xs text-muted px-1 sm:hidden">Każda linia = osobny wpis</p>
          <button
            type="button"
            onClick={() => void save()}
            data-testid="dump-save"
            className="shrink-0 inline-flex items-center gap-2 min-h-12 px-5 rounded-2xl bg-accent text-accent-ink font-semibold active:scale-95 transition"
          >
            <Icon name="check" size={18} /> Zapisz
          </button>
        </div>
      </div>
    </div>
  )
}
