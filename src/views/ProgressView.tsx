import { useMemo, useState } from 'react'
import { useXp } from '../lib/hooks'
import { computeStreak, levelInfo, LEVEL_NAMES, xpForLevel } from '../lib/gamification'
import { addDays, humanDay, parseDay, plural, today } from '../lib/dates'
import { setSettings, useSettings } from '../lib/settings'
import type { XpEvent } from '../lib/types'
import { Icon } from '../components/Icon'
import { Section, Segmented } from '../components/ui'
import { toast } from '../lib/ui'

const REASON_EMOJI: Record<string, string> = { task: '✅', step: '👣', dump: '🧠', triage: '📥', focus: '⏳', note: '📝', plan: '⭐', break: '☕' }
const TOKEN_COLORS = ['#7fb69a', '#f2c879', '#b8a4e3', '#f4a38c', '#8cc7e8', '#e9a6c7']

export function ProgressView() {
  const xp = useXp()
  const s = useSettings()
  const td = today()
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today')
  const total = xp.reduce((a, x) => a + x.amount, 0)
  const lvl = levelInfo(total)
  const streak = useMemo(() => computeStreak(new Set(xp.map((x) => x.day)), td, s.restDays), [xp, td, s.restDays])

  const wins = useMemo(() => {
    const from = range === 'today' ? td : range === 'week' ? addDays(td, -6) : '0000'
    return xp.filter((x) => x.day >= from && (x.reason === 'task' || x.reason === 'step' || x.reason === 'focus' || x.reason === 'plan')).sort((a, b) => b.createdAt - a.createdAt)
  }, [xp, range, td])

  const last14 = Array.from({ length: 14 }, (_, i) => addDays(td, i - 13))
  const activeDays = new Set(xp.map((x) => x.day))
  const restToday = s.restDays.includes(td)

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Postępy</h1>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div className="rounded-3xl bg-surface border border-line/70 p-5">
          <p className="text-sm text-muted">Poziom {lvl.level}</p>
          <p className="text-2xl font-bold">{lvl.name} ✨</p>
          <div className="mt-3 h-3 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(lvl.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(3, lvl.progress * 100)}%` }} />
          </div>
          <p className="text-sm text-muted mt-2">
            {total} XP · do kolejnego poziomu: {lvl.span - lvl.into} XP
          </p>
        </div>
        <div className="rounded-3xl bg-surface border border-line/70 p-5">
          <p className="text-sm text-muted">Łagodna seria</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            <Icon name="flame" className="text-sun" /> {streak.activeDays} {streak.activeDays === 1 ? 'dzień' : 'dni'}
          </p>
          <div className="flex gap-1 mt-3" aria-label="Ostatnie 14 dni">
            {last14.map((d) => {
              const active = activeDays.has(d)
              const rest = s.restDays.includes(d) || (!active && streak.restDays.includes(d))
              return (
                <div
                  key={d}
                  title={`${humanDay(d)}${active ? ' — aktywny' : rest ? ' — dzień wolny' : ''}`}
                  className={`flex-1 h-7 rounded-md grid place-items-center text-[10px] ${active ? 'bg-accent text-accent-ink' : rest ? 'bg-lav-soft text-lav' : 'bg-surface-2 text-muted'} ${d === td ? 'ring-2 ring-accent/50' : ''}`}
                >
                  {active ? '' : rest ? '🌙' : parseDay(d).getDate()}
                </div>
              )
            })}
          </div>
          <p className="text-sm text-muted mt-2">
            Jeden pusty dzień to automatyczny 🌙 dzień wolny — seria trwa. {streak.best > 1 && `Najdłuższa: ${streak.best}.`}
          </p>
          <button
            type="button"
            className="mt-2 text-sm underline text-muted min-h-9"
            onClick={() => {
              setSettings({ restDays: restToday ? s.restDays.filter((d) => d !== td) : [...s.restDays, td] })
              if (!restToday) toast('Dziś odpoczywasz 🌙 Odpoczynek też jest produktywny.', { tone: 'info' })
            }}
          >
            {restToday ? 'Cofnij dzień wolny' : 'Ogłaszam dziś dzień wolny 🌙'}
          </button>
        </div>
      </div>

      <Section title="🫙 Słoik wygranych">
        <Segmented
          className="mb-3"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Dziś' },
            { value: 'week', label: '7 dni' },
            { value: 'all', label: 'Wszystko' },
          ]}
        />
        <Jar events={wins} />
        {wins.length === 0 ? (
          <p className="text-muted text-sm mt-3 px-1">
            {range === 'today' ? 'Jeszcze pusto — pierwszy odhaczony krok wrzuci tu żeton.' : 'Słoik czeka na pierwsze żetony.'}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-1.5">
            {wins.slice(0, 40).map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 min-h-11 border border-line/50">
                <span aria-hidden>{REASON_EMOJI[w.reason] ?? '✨'}</span>
                <span className="flex-1 min-w-0 truncate">{w.label}</span>
                <span className="text-xs text-muted shrink-0">{range !== 'today' ? humanDay(w.day) + ' · ' : ''}+{w.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Poziomy" collapsible defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {LEVEL_NAMES.map((n, i) => (
            <div key={n} className={`rounded-2xl p-3 text-center text-sm ${i + 1 <= lvl.level ? 'bg-accent-soft' : 'bg-surface-2 text-muted'}`}>
              <div className="font-semibold">{n}</div>
              <div className="text-xs">{xpForLevel(i + 1)} XP</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted mt-3">
          XP nigdy nie spada. Za zadanie: 10, za krok: 3, za sesję skupienia: 5, za zrzut myśli i porządki: 1. Liczy się każdy ruch.
        </p>
      </Section>
    </div>
  )
}

function Jar({ events }: { events: XpEvent[] }) {
  const tokens = events.slice(0, 60)
  return (
    <div className="flex justify-center">
      <div className="relative w-48 h-56" aria-label={`Słoik: ${events.length} żetonów`} role="img">
        <svg viewBox="0 0 200 230" className="absolute inset-0 w-full h-full">
          <rect x="55" y="6" width="90" height="18" rx="6" fill="var(--sun-soft)" stroke="var(--sun)" strokeWidth="2" />
          <path d="M60 26 h80 v10 c22 8 34 22 34 46 v118 a24 24 0 0 1 -24 24 h-100 a24 24 0 0 1 -24 -24 v-118 c0 -24 12 -38 34 -46 z" fill="var(--surface)" stroke="var(--line)" strokeWidth="3" />
        </svg>
        <div className="absolute left-[16%] right-[16%] bottom-[7%] top-[30%] flex flex-wrap-reverse content-start justify-center gap-[3px] overflow-hidden">
          {tokens.map((t, i) => (
            <span
              key={t.id}
              className="w-[18px] h-[18px] rounded-full anim-token shadow-sm"
              style={{ background: TOKEN_COLORS[i % TOKEN_COLORS.length], animationDelay: `${Math.min(i, 20) * 30}ms` }}
              title={t.label}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 -bottom-6 text-center text-sm font-semibold">{events.length} {plural(events.length, 'wygrana', 'wygrane', 'wygranych')}</div>
      </div>
    </div>
  )
}
