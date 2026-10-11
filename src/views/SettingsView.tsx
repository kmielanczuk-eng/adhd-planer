import { useEffect, useRef, useState, type ReactNode } from 'react'
import { setSettings, useSettings, type Theme } from '../lib/settings'
import { sendMagicLink, signOut, syncNow, useAccount, verifyCode } from '../lib/account'
import { SYNC_ENABLED } from '../config'
import { downloadBackup, importData } from '../lib/backup'
import { toast } from '../lib/ui'
import { testAiKey, AI_MODEL } from '../lib/ai'
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  notificationsSupported,
  pushSupported,
  requestPermission,
  sendTestPush,
  showLocalNotification,
} from '../lib/notify'
import { playSound } from '../lib/feedback'
import { Button, Chip, Segmented } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'

function Card({ title, icon, children, id }: { title: string; icon: IconName; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-3xl bg-surface border border-line/70 p-5 mb-4 scroll-mt-20">
      <h2 className="font-semibold text-lg flex items-center gap-2 mb-3">
        <Icon name={icon} size={18} className="text-accent" /> {title}
      </h2>
      {children}
    </section>
  )
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 min-h-12 cursor-pointer">
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export function SettingsView() {
  const s = useSettings()
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Ustawienia</h1>

      <Card title="Ty i wygląd" icon="smile">
        <label className="block mb-4">
          <span className="text-sm text-muted">Jak mam się do ciebie zwracać? (opcjonalnie)</span>
          <input
            defaultValue={s.name}
            onBlur={(e) => setSettings({ name: e.target.value.trim() })}
            placeholder="Imię"
            className="mt-1 w-full min-h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <p className="text-sm text-muted mb-2">Motyw</p>
        <Segmented<Theme>
          value={s.theme}
          onChange={(theme) => setSettings({ theme })}
          options={[
            { value: 'system', label: 'Systemowy' },
            { value: 'light', label: 'Jasny' },
            { value: 'dark', label: 'Ciemny' },
          ]}
        />
        <div className="mt-3 divide-y divide-line">
          <Toggle label="Dźwięki nagród" checked={s.sound} onChange={(v) => { setSettings({ sound: v }); if (v) playSound('done') }} />
          <Toggle label="Konfetti" checked={s.confetti} onChange={(v) => setSettings({ confetti: v })} />
          <Toggle label="Mniej animacji" checked={s.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} />
        </div>
        <p className="text-sm text-muted mt-3 mb-2">Ile rzeczy „na dziś”? (miękki limit)</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} active={s.dailyLimit === n} onClick={() => setSettings({ dailyLimit: n })}>
              {n}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-muted mt-3 mb-2">Domyślna długość sesji skupienia</p>
        <div className="flex gap-2 flex-wrap">
          {[10, 15, 25, 45].map((n) => (
            <Chip key={n} tone="lav" active={s.focusMinutes === n} onClick={() => setSettings({ focusMinutes: n })}>
              {n} min
            </Chip>
          ))}
        </div>
      </Card>

      <AccountCard />
      <NotificationsCard />
      <AiCard />
      <BackupCard />

      <Card title="Skróty klawiszowe" icon="keyboard">
        <ul className="text-sm grid gap-1.5">
          {[
            ['N  lub  Ctrl/⌘ + K', 'Zrzut myśli z dowolnego miejsca'],
            ['G potem D / T / I / Z / O', 'Dziś / Co teraz? / Inbox / Zadania / nOtatki'],
            ['Esc', 'Zamknij okno'],
          ].map(([k, d]) => (
            <li key={k} className="flex justify-between gap-4">
              <kbd className="font-mono bg-surface-2 rounded-lg px-2 py-0.5">{k}</kbd>
              <span className="text-muted text-right">{d}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-muted text-center my-6">Ogarniacz · prywatny planer · dane są przede wszystkim na tym urządzeniu</p>
    </div>
  )
}

function AccountCard() {
  const { user, sync } = useAccount()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!SYNC_ENABLED)
    return (
      <Card title="Konto i synchronizacja" icon="cloud">
        <p className="text-muted text-sm">Synchronizacja nie jest skonfigurowana w tej wersji. Wszystko działa lokalnie.</p>
      </Card>
    )

  const stateLabel: Record<string, string> = {
    off: 'wyłączona',
    idle: 'aktualna',
    syncing: 'synchronizuję…',
    error: 'błąd',
    offline: 'offline — zsynchronizuję po powrocie sieci',
  }

  return (
    <Card title="Konto i synchronizacja" icon="cloud" id="konto">
      {user ? (
        <>
          <p className="text-sm">
            Zalogowano jako <strong>{user.email}</strong>
          </p>
          <p className="text-sm text-muted mt-1">
            Synchronizacja: {stateLabel[sync.state]}
            {sync.lastSync && sync.state === 'idle' ? ` · ostatnio ${new Date(sync.lastSync).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
          {sync.state === 'error' && sync.error && (
            <p className="text-sm text-peach mt-2">
              {sync.error}
              {/relation|records|schema|does not exist|not find the table/i.test(sync.error) && ' — baza nie jest jeszcze przygotowana (patrz RANO_ZROB_TO.md).'}
            </p>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button icon="refresh" onClick={syncNow}>
              Synchronizuj teraz
            </Button>
            <Button variant="ghost" icon="logout" onClick={() => void signOut()}>
              Wyloguj
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">
            Apka działa bez konta. Zaloguj się, żeby mieć te same dane na telefonie i komputerze. Bez hasła — dostaniesz link (i kod) na maila.
          </p>
          {!sent ? (
            <form
              className="flex gap-2 flex-wrap"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setErr(null)
                try {
                  await sendMagicLink(email.trim())
                  setSent(true)
                } catch (e2) {
                  setErr((e2 as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
                autoComplete="email"
                aria-label="E-mail"
                className="flex-1 min-w-48 min-h-11 rounded-xl bg-surface-2 px-3 outline-none focus:ring-2 focus:ring-accent/40"
              />
              <Button type="submit" variant="primary" icon="mail" disabled={busy}>
                {busy ? 'Wysyłam…' : 'Wyślij link'}
              </Button>
            </form>
          ) : (
            <div>
              <p className="text-sm">
                📬 Wysłane na <strong>{email}</strong>. Kliknij link w mailu — albo, jeśli mail zawiera kod, wpisz go tutaj (przydatne w apce na iPhonie):
              </p>
              <form
                className="flex gap-2 mt-2 flex-wrap"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setErr(null)
                  try {
                    await verifyCode(email.trim(), code)
                    toast('Zalogowano! Synchronizuję dane…', { tone: 'success' })
                  } catch (e2) {
                    setErr((e2 as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Kod z maila"
                  aria-label="Kod z maila"
                  className="w-40 min-h-11 rounded-xl bg-surface-2 px-3 outline-none tracking-widest focus:ring-2 focus:ring-accent/40"
                />
                <Button type="submit" variant="primary" disabled={busy || code.trim().length < 6}>
                  Zaloguj
                </Button>
                <Button variant="ghost" onClick={() => setSent(false)}>
                  Zmień e-mail
                </Button>
              </form>
            </div>
          )}
          {err && <p className="text-sm text-peach mt-2">{err}</p>}
        </>
      )}
    </Card>
  )
}

function NotificationsCard() {
  const s = useSettings()
  const { user } = useAccount()
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported')
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ios = isIOS()
  const standalone = isStandalone()

  useEffect(() => {
    void currentPushSubscription().then((sub) => setPushOn(!!sub))
  }, [])

  return (
    <Card title="Powiadomienia i przypomnienia" icon="bell" id="powiadomienia">
      {ios && !standalone && (
        <div className="rounded-2xl bg-sky-soft p-4 mb-4 text-sm">
          <p className="font-semibold mb-1">📱 iPhone: najpierw dodaj apkę do ekranu głównego</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>
              W Safari stuknij <strong>Udostępnij</strong> <Icon name="share" size={14} className="inline -mt-1" />.
            </li>
            <li>
              Wybierz <strong>„Do ekranu początkowego”</strong>.
            </li>
            <li>Otwórz Ogarniacza z ikony i wróć tutaj, żeby włączyć powiadomienia.</li>
          </ol>
          <p className="text-muted mt-1">Apple pozwala na powiadomienia web tylko apkom dodanym do ekranu głównego (iOS 16.4+).</p>
        </div>
      )}
      <Toggle
        label="Przypomnienia, gdy apka jest otwarta"
        hint="Dymek w apce + powiadomienie systemowe, gdy karta jest w tle"
        checked={s.localNotifications}
        onChange={(v) => setSettings({ localNotifications: v })}
      />
      <div className="flex gap-2 flex-wrap mt-2">
        {perm !== 'granted' && perm !== 'unsupported' && (
          <Button
            onClick={async () => {
              setPerm(await requestPermission())
            }}
          >
            Zezwól na powiadomienia
          </Button>
        )}
        {perm === 'granted' && (
          <Button variant="ghost" onClick={() => void showLocalNotification('Tak to będzie wyglądać 👋', 'Przypomnienie z Ogarniacza')}>
            Pokaż przykładowe
          </Button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <p className="font-medium">Push — także przy zamkniętej apce</p>
        <p className="text-sm text-muted mt-1">
          Przypomnienia przychodzą z serwera, nawet gdy Ogarniacz jest zamknięty. Wymaga zalogowania{ios ? ' i dodania apki do ekranu głównego' : ''}.
        </p>
        {!pushSupported() && !ios && <p className="text-sm text-muted mt-2">Ta przeglądarka nie obsługuje push.</p>}
        <div className="flex gap-2 flex-wrap mt-3">
          {!pushOn ? (
            <Button
              variant="primary"
              icon="bell"
              disabled={busy || !user}
              onClick={async () => {
                setBusy(true)
                setMsg(null)
                try {
                  await enablePush()
                  setPushOn(true)
                  setPerm('granted')
                  setMsg('Push włączony na tym urządzeniu ✔')
                } catch (e) {
                  setMsg((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {user ? 'Włącz push na tym urządzeniu' : 'Najpierw zaloguj się'}
            </Button>
          ) : (
            <>
              <Button
                icon="bell"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    setMsg(await sendTestPush())
                  } catch (e) {
                    setMsg((e as Error).message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Wyślij testowy push
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await disablePush()
                  setPushOn(false)
                  setMsg('Push wyłączony na tym urządzeniu.')
                }}
              >
                Wyłącz push
              </Button>
            </>
          )}
        </div>
        {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
      </div>
    </Card>
  )
}

function AiCard() {
  const s = useSettings()
  const [val, setVal] = useState(s.aiKey)
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Card title="AI: rozbijanie zadań na kroki" icon="sparkles" id="ai">
      <p className="text-sm text-muted mb-3">
        Wklej swój klucz API Anthropic (zaczyna się od <code>sk-ant-</code>). Klucz zostaje <strong>tylko na tym urządzeniu</strong> — nie trafia do synchronizacji ani do kopii.
        Zapytania idą prosto z przeglądarki do API Anthropic (model {AI_MODEL}). Klucz utworzysz na <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          type={show ? 'text' : 'password'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Klucz API Anthropic"
          className="flex-1 min-w-48 min-h-11 rounded-xl bg-surface-2 px-3 outline-none font-mono text-sm focus:ring-2 focus:ring-accent/40"
        />
        <Button variant="ghost" icon="eye" onClick={() => setShow(!show)} aria-label={show ? 'Ukryj klucz' : 'Pokaż klucz'} />
      </div>
      <div className="flex gap-2 flex-wrap mt-3">
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setSettings({ aiKey: val.trim() })
            if (!val.trim()) {
              setStatus('Klucz usunięty.')
              return
            }
            setBusy(true)
            setStatus('Sprawdzam klucz…')
            const err = await testAiKey()
            setBusy(false)
            setStatus(err ? `Zapisano, ale test się nie udał: ${err}` : 'Zapisano i działa ✔')
          }}
        >
          Zapisz i sprawdź
        </Button>
        {s.aiKey && (
          <Button
            variant="ghost"
            onClick={() => {
              setVal('')
              setSettings({ aiKey: '' })
              setStatus('Klucz usunięty z urządzenia.')
            }}
          >
            Usuń klucz
          </Button>
        )}
      </div>
      {status && <p className="text-sm mt-2" role="status">{status}</p>}
    </Card>
  )
}

function BackupCard() {
  const file = useRef<HTMLInputElement>(null)
  return (
    <Card title="Kopia zapasowa" icon="download">
      <p className="text-sm text-muted mb-3">Eksport zapisuje wszystkie zadania, notatki, XP i menu przerw do pliku JSON. Import scala dane — niczego nie kasuje, nowsza wersja wygrywa.</p>
      <div className="flex gap-2 flex-wrap">
        <Button icon="download" onClick={() => void downloadBackup().then(() => toast('Kopia pobrana', { tone: 'success' }))} data-testid="export">
          Eksportuj JSON
        </Button>
        <Button icon="upload" onClick={() => file.current?.click()}>
          Importuj JSON
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-input"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const res = await importData(JSON.parse(await f.text()))
              toast(`Zaimportowano: ${res.added} nowych, ${res.updated} zaktualizowanych`, { tone: 'success' })
            } catch (err) {
              toast(err instanceof SyntaxError ? 'Plik nie jest poprawnym JSON-em.' : (err as Error).message, { tone: 'info' })
            }
          }}
        />
      </div>
    </Card>
  )
}
