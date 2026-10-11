import { useState } from 'react'
import { useDopamine } from '../lib/hooks'
import { addDopamine, deleteDopamine } from '../lib/actions'
import { startFocus, toast } from '../lib/ui'
import { rewardXp } from '../lib/flows'
import type { DopamineItem } from '../lib/types'
import { Button, Chip, Empty, IconButton } from '../components/ui'
import { Icon } from '../components/Icon'

const KINDS: Array<{ kind: DopamineItem['kind']; title: string; hint: string; emoji: string }> = [
  { kind: 'starter', title: 'Przystawki', hint: 'szybkie, 2–5 min — na reset', emoji: '🥨' },
  { kind: 'main', title: 'Dania główne', hint: 'dłuższe, naprawdę ładują baterie', emoji: '🍲' },
  { kind: 'side', title: 'Dodatki', hint: 'do połączenia z nudnym zadaniem', emoji: '🎧' },
  { kind: 'dessert', title: 'Desery', hint: 'przyjemne, ale wciągające — zawsze z timerem', emoji: '🍰' },
]

export function BreakView() {
  const items = useDopamine()
  const [picked, setPicked] = useState<DopamineItem | null>(null)
  const [adding, setAdding] = useState<DopamineItem['kind'] | null>(null)
  const [title, setTitle] = useState('')
  const [mins, setMins] = useState<number | null>(5)

  const random = (pool: DopamineItem[]) => {
    if (!pool.length) return
    setPicked(pool[Math.floor(Math.random() * pool.length)])
  }

  const take = (it: DopamineItem) => {
    void rewardXp('break', `Przerwa: ${it.title}`)
    if (it.minutes) startFocus({ taskId: null, title: `☕ ${it.title}`, minutes: it.minutes, starter: false })
    else toast('Miłej przerwy! 💛', { tone: 'success' })
    setPicked(null)
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold">Menu dopaminowe</h1>
      <p className="text-muted mt-1 mb-5">Przerwa, która naprawdę ładuje — wybrana zawczasu, gdy mózg jeszcze nie szuka telefonu.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="primary" icon="shuffle" onClick={() => random(items.filter((i) => i.kind !== 'dessert'))}>
          Wylosuj mi przerwę
        </Button>
        <Button icon="coffee" onClick={() => random(items.filter((i) => i.kind === 'starter'))}>
          Coś na 5 minut
        </Button>
      </div>

      {picked && (
        <div className="mb-6 rounded-3xl bg-sun-soft p-5 anim-pop">
          <p className="text-sm text-muted">Propozycja:</p>
          <p className="text-xl font-bold mt-1">{picked.title}</p>
          {picked.minutes && <p className="text-sm text-muted mt-1">ok. {picked.minutes} min — włączę timer, żeby przerwa nie zjadła dnia.</p>}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button variant="primary" icon="play" onClick={() => take(picked)}>
              Biorę to
            </Button>
            <Button icon="shuffle" onClick={() => random(items.filter((i) => i.kind === picked.kind && i.id !== picked.id))}>
              Coś innego
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 && <Empty emoji="☕" title="Menu jest puste" />}

      {KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k.kind)
        return (
          <section key={k.kind} className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="font-semibold">
                {k.emoji} {k.title} <span className="text-sm text-muted font-normal">— {k.hint}</span>
              </h2>
              <IconButton icon="plus" label={`Dodaj: ${k.title}`} onClick={() => setAdding(adding === k.kind ? null : k.kind)} />
            </div>
            {adding === k.kind && (
              <div className="rounded-2xl bg-surface-2 p-3 mb-2 anim-pop">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Kawa na balkonie"
                  aria-label="Nazwa aktywności"
                  className="w-full min-h-11 rounded-xl bg-surface px-3 outline-none mb-2"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  {[2, 5, 10, 15, 25, null].map((m) => (
                    <Chip key={String(m)} active={mins === m} onClick={() => setMins(m)}>
                      {m ? `${m} min` : 'bez timera'}
                    </Chip>
                  ))}
                  <Button
                    size="sm"
                    variant="primary"
                    className="ml-auto"
                    onClick={async () => {
                      if (!title.trim()) return
                      await addDopamine({ title: title.trim(), minutes: mins, kind: k.kind })
                      setTitle('')
                      setAdding(null)
                    }}
                  >
                    Dodaj
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {list.map((it) => (
                <div key={it.id} className="group flex items-center gap-2 rounded-2xl bg-surface border border-line/60 pl-4 pr-1 min-h-12">
                  <button type="button" className="flex-1 text-left py-2" onClick={() => setPicked(it)}>
                    {it.title}
                    {it.minutes ? <span className="text-xs text-muted ml-2">{it.minutes} min</span> : null}
                  </button>
                  <IconButton
                    icon="x"
                    label="Usuń z menu"
                    size={16}
                    className="opacity-50 group-hover:opacity-100"
                    onClick={() => {
                      void deleteDopamine(it.id)
                      toast('Usunięto z menu', { undo: () => addDopamine({ title: it.title, minutes: it.minutes, kind: it.kind }) })
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <p className="text-xs text-muted flex items-center gap-1.5">
        <Icon name="heart" size={14} /> Pomysł „menu dopaminowego” spopularyzowała Jessica McCabe (How to ADHD).
      </p>
    </div>
  )
}
