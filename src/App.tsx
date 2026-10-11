import { useEffect, useMemo, useRef } from 'react'
import { navigate, useRoute } from './lib/router'
import { dismissToast, openDump, showLevelUp, useUI } from './lib/ui'
import { useTasks, useXp } from './lib/hooks'
import { inboxTasks } from './lib/selectors'
import { levelInfo } from './lib/gamification'
import { useAccount } from './lib/account'
import { applyTheme, setSettings, useSettings } from './lib/settings'
import { isIOS, isStandalone } from './lib/notify'
import { Icon, type IconName } from './components/Icon'
import { BrainDump } from './components/BrainDump'
import { TaskDetailHost } from './components/TaskDetail'
import { FocusHost } from './components/FocusTimer'
import { Button } from './components/ui'
import { TodayView } from './views/TodayView'
import { NowView } from './views/NowView'
import { InboxView } from './views/InboxView'
import { TasksView } from './views/TasksView'
import { NotesView } from './views/NotesView'
import { ProgressView } from './views/ProgressView'
import { SettingsView } from './views/SettingsView'
import { BreakView } from './views/BreakView'

interface NavItem {
  path: string
  label: string
  icon: IconName
  match: string
}

const NAV: NavItem[] = [
  { path: '/dzis', label: 'Dziś', icon: 'sun', match: 'dzis' },
  { path: '/teraz', label: 'Co teraz?', icon: 'target', match: 'teraz' },
  { path: '/inbox', label: 'Inbox', icon: 'inbox', match: 'inbox' },
  { path: '/zadania/wszystkie', label: 'Zadania', icon: 'list', match: 'zadania' },
  { path: '/notatki', label: 'Notatki', icon: 'note', match: 'notatki' },
]

const SECONDARY: NavItem[] = [
  { path: '/postepy', label: 'Postępy', icon: 'jar', match: 'postepy' },
  { path: '/przerwa', label: 'Przerwa', icon: 'coffee', match: 'przerwa' },
  { path: '/ustawienia', label: 'Ustawienia', icon: 'settings', match: 'ustawienia' },
]

export default function App() {
  const route = useRoute()
  const settings = useSettings()
  const tasks = useTasks()
  const inboxCount = useMemo(() => inboxTasks(tasks).length, [tasks])
  const section = route.parts[0] ?? 'dzis'

  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => applyTheme('system')
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [settings.theme])

  useGlobalShortcuts()

  useEffect(() => {
    if (route.query.get('dump') === '1') {
      openDump()
      navigate('/inbox', true)
    }
  }, [route])

  let view: React.ReactNode
  switch (section) {
    case 'teraz':
      view = <NowView />
      break
    case 'inbox':
      view = <InboxView />
      break
    case 'zadania':
      view = <TasksView />
      break
    case 'notatki':
      view = <NotesView />
      break
    case 'postepy':
      view = <ProgressView />
      break
    case 'przerwa':
      view = <BreakView />
      break
    case 'ustawienia':
      view = <SettingsView />
      break
    default:
      view = <TodayView />
  }

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar section={section} inboxCount={inboxCount} />
      <div className="flex-1 min-w-0">
        <TopBar section={section} />
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-2 pb-36 lg:pb-16" key={section}>
          <InstallHint />
          {view}
        </main>
      </div>
      <BottomNav section={section} inboxCount={inboxCount} />
      <Fab />
      <BrainDump />
      <TaskDetailHost />
      <FocusHost />
      <Toasts />
      <LevelUp />
    </div>
  )
}

function useGlobalShortcuts() {
  const pendingG = useRef(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openDump()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if (pendingG.current) {
        pendingG.current = false
        const map: Record<string, string> = { d: '/dzis', t: '/teraz', i: '/inbox', z: '/zadania/wszystkie', o: '/notatki', p: '/postepy', u: '/ustawienia' }
        if (map[k]) {
          e.preventDefault()
          navigate(map[k])
        }
        return
      }
      if (k === 'n' || k === '+') {
        e.preventDefault()
        openDump()
      } else if (k === 'g') {
        pendingG.current = true
        setTimeout(() => (pendingG.current = false), 1200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function XpChip() {
  const xp = useXp()
  const pulse = useUI((s) => s.xpPulse)
  const total = xp.reduce((a, x) => a + x.amount, 0)
  const lvl = levelInfo(total)
  return (
    <button
      type="button"
      onClick={() => navigate('/postepy')}
      className="relative inline-flex items-center gap-2 rounded-full bg-surface border border-line/70 pl-2 pr-3 min-h-10 text-sm"
      aria-label={`Poziom ${lvl.level}, ${total} XP — zobacz postępy`}
      data-testid="xp-chip"
    >
      <span className="relative w-7 h-7">
        <svg viewBox="0 0 36 36" className="w-7 h-7 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-2)" strokeWidth="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="4" strokeDasharray={`${Math.max(2, lvl.progress * 94.2)} 94.2`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[11px] font-bold">{lvl.level}</span>
      </span>
      <span className="font-semibold tabular-nums">{total} XP</span>
      {pulse && (
        <span key={pulse.id} className="absolute -top-3 right-1 text-xs font-bold text-accent anim-float pointer-events-none">
          +{pulse.amount}
        </span>
      )}
    </button>
  )
}

function SyncDot() {
  const { user, sync } = useAccount()
  if (!user) return null
  const map = {
    idle: ['cloud', 'text-accent', 'Zsynchronizowane'],
    syncing: ['refresh', 'text-muted animate-spin', 'Synchronizuję…'],
    offline: ['cloudOff', 'text-muted', 'Offline — zmiany zapisane lokalnie'],
    error: ['cloudOff', 'text-sun', 'Problem z synchronizacją (dane są bezpieczne lokalnie)'],
    off: ['cloudOff', 'text-muted', 'Synchronizacja wyłączona'],
  } as const
  const [icon, cls, label] = map[sync.state]
  return (
    <button type="button" onClick={() => navigate('/ustawienia')} title={label} aria-label={label} className="min-w-10 min-h-10 grid place-items-center rounded-full hover:bg-surface-2">
      <Icon name={icon} size={18} className={cls} />
    </button>
  )
}

function TopBar({ section }: { section: string }) {
  return (
    <div className="sticky top-0 z-30 bg-bg/85 backdrop-blur safe-top">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate('/dzis')} className="lg:invisible font-bold text-lg flex items-center gap-2 min-h-10" aria-label="Ogarniacz — strona główna">
          <Logo /> Ogarniacz
        </button>
        <div className="flex items-center gap-1">
          <SyncDot />
          <XpChip />
          <button
            type="button"
            onClick={() => navigate('/ustawienia')}
            className={`lg:hidden min-w-10 min-h-10 grid place-items-center rounded-full hover:bg-surface-2 ${section === 'ustawienia' ? 'text-accent' : 'text-muted'}`}
            aria-label="Ustawienia"
          >
            <Icon name="settings" size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="var(--accent-ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="7.5" r="2" fill="var(--sun-soft)" />
    </svg>
  )
}

function Sidebar({ section, inboxCount }: { section: string; inboxCount: number }) {
  return (
    <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 h-dvh sticky top-0 border-r border-line/70 px-3 py-5">
      <button type="button" onClick={() => navigate('/dzis')} className="flex items-center gap-2 font-bold text-lg px-3 mb-5">
        <Logo /> Ogarniacz
      </button>
      <Button variant="primary" icon="plus" className="mb-5 mx-1" onClick={openDump}>
        Zrzut myśli <kbd className="ml-auto text-xs opacity-70 font-mono">N</kbd>
      </Button>
      <nav className="flex flex-col gap-0.5" aria-label="Główna nawigacja">
        {NAV.map((n) => (
          <SideLink key={n.path} item={n} active={section === n.match} badge={n.match === 'inbox' ? inboxCount : 0} />
        ))}
        <div className="h-px bg-line my-3 mx-3" />
        {SECONDARY.map((n) => (
          <SideLink key={n.path} item={n} active={section === n.match} />
        ))}
      </nav>
    </aside>
  )
}

function SideLink({ item, active, badge = 0 }: { item: NavItem; active: boolean; badge?: number }) {
  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 min-h-11 text-left transition ${active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink hover:bg-surface-2'}`}
    >
      <Icon name={item.icon} size={19} />
      <span className="flex-1">{item.label}</span>
      {badge > 0 && <span className="text-xs rounded-full bg-sky-soft px-2 py-0.5 text-ink">{badge}</span>}
    </button>
  )
}

function BottomNav({ section, inboxCount }: { section: string; inboxCount: number }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line/70 safe-bottom" aria-label="Główna nawigacja">
      <div className="grid grid-cols-5 max-w-xl mx-auto">
        {NAV.map((n) => {
          const active = section === n.match
          return (
            <button
              key={n.path}
              type="button"
              onClick={() => navigate(n.path)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-16 text-[11px] font-medium ${active ? 'text-accent' : 'text-muted'}`}
            >
              <span className={`grid place-items-center w-12 h-7 rounded-full transition ${active ? 'bg-accent-soft' : ''}`}>
                <Icon name={n.icon} size={21} />
              </span>
              {n.label}
              {n.match === 'inbox' && inboxCount > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2.5 min-w-5 h-5 px-1 rounded-full bg-lav text-white dark:text-black text-[10px] font-bold grid place-items-center">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function Fab() {
  return (
    <button
      type="button"
      onClick={openDump}
      aria-label="Zrzut myśli (N)"
      title="Zrzut myśli (N)"
      data-testid="fab"
      className="lg:hidden fixed z-40 right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] w-16 h-16 rounded-2xl bg-accent text-accent-ink shadow-lg shadow-accent/30 grid place-items-center active:scale-90 transition"
    >
      <Icon name="plus" size={30} strokeWidth={2.5} />
    </button>
  )
}

function Toasts() {
  const toasts = useUI((s) => s.toasts)
  return (
    <div className="fixed z-[80] inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] lg:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-md w-full sm:w-auto flex items-center gap-3 rounded-2xl shadow-xl px-4 min-h-12 py-2 anim-pop ${
            t.tone === 'success' ? 'bg-ink text-bg' : 'bg-ink text-bg'
          }`}
          role="status"
        >
          <span className="flex-1 text-sm">{t.text}</span>
          {t.undo && (
            <button
              type="button"
              onClick={() => {
                dismissToast(t.id)
                void t.undo!()
              }}
              className="shrink-0 font-semibold text-sm min-h-10 px-2 rounded-lg text-accent-soft hover:underline inline-flex items-center gap-1"
              data-testid="toast-action"
            >
              {!t.actionLabel && <Icon name="undo" size={14} />}
              {t.actionLabel ?? 'Cofnij'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function LevelUp() {
  const level = useUI((s) => s.levelUp)
  const xp = useXp()
  if (!level) return null
  const info = levelInfo(xp.reduce((a, x) => a + x.amount, 0))
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="Nowy poziom">
      <div className="absolute inset-0 bg-black/40 anim-fade" onClick={() => showLevelUp(null)} />
      <div className="relative rounded-3xl bg-surface p-8 text-center max-w-sm anim-pop shadow-2xl">
        <div className="text-6xl mb-2">🌟</div>
        <p className="text-sm text-muted">Nowy poziom!</p>
        <p className="text-3xl font-bold mt-1">
          {level}. {info.name}
        </p>
        <p className="text-muted mt-2">Każdy mały krok się sumuje. Jesteś w drodze.</p>
        <Button variant="primary" className="mt-5" onClick={() => showLevelUp(null)}>
          Super!
        </Button>
      </div>
    </div>
  )
}

function InstallHint() {
  const s = useSettings()
  if (s.seenIosHint || !isIOS() || isStandalone()) return null
  return (
    <div className="mb-4 rounded-2xl bg-sky-soft p-4 text-sm flex gap-3 items-start">
      <span className="text-xl" aria-hidden>
        📲
      </span>
      <div className="flex-1">
        <p className="font-semibold">Zainstaluj na iPhonie</p>
        <p className="mt-0.5">
          Stuknij <strong>Udostępnij</strong> <Icon name="share" size={14} className="inline -mt-1" /> → <strong>„Do ekranu początkowego”</strong>. Apka otworzy się na pełnym ekranie, zadziała offline i będzie mogła wysyłać przypomnienia.
        </p>
      </div>
      <button type="button" onClick={() => setSettings({ seenIosHint: true })} className="min-w-10 min-h-10 grid place-items-center rounded-full text-muted" aria-label="Zamknij podpowiedź">
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
