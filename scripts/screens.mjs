// Zrzuty ekranu do przeglądu UI: node scripts/screens.mjs <katalog_wyjściowy> [dark]
import { chromium, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const out = process.argv[2] || 'screenshots'
const dark = process.argv[3] === 'dark'
fs.mkdirSync(out, { recursive: true })
const base = 'http://localhost:4173/adhd-planer/'
const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10) }
const now = Date.now()
let n = 0
const t = (p) => ({ id: 'seed-' + ++n, createdAt: now - n * 1000, updatedAt: now - n * 1000, deleted: 0, dirty: 0, title: '', details: '', status: 'open', due: null, estimate: null, energy: null, steps: [], tags: [], project: null, remindAt: null, pinnedFor: null, completedAt: null, noteId: null, skips: 0, ...p })
const fixture = {
  app: 'ogarniacz', version: 1, exportedAt: new Date().toISOString(),
  data: {
    tasks: [
      t({ title: 'Zadzwonić do dentysty', pinnedFor: d(0), estimate: 5, energy: 'low', tags: ['zdrowie'] }),
      t({ title: 'Wysłać fakturę za wrzesień', pinnedFor: d(0), estimate: 30, energy: 'medium', project: 'Praca', steps: [{ id: 's1', title: 'Otworzyć program do faktur', done: true }, { id: 's2', title: 'Skopiować dane klienta', done: false }, { id: 's3', title: 'Wysłać maila', done: false }] }),
      t({ title: 'Ogarnąć pranie', due: d(0), estimate: 15, energy: 'low', tags: ['dom'] }),
      t({ title: 'Odpisać Kasi na wiadomość', due: d(-2) }),
      t({ title: 'Zapłacić rachunek za prąd', due: d(-5), estimate: 5 }),
      t({ title: 'Kupić prezent dla mamy', due: d(2), project: 'Dom' }),
      t({ title: 'Przygotować prezentację', due: d(4), estimate: 120, energy: 'high', project: 'Praca' }),
      t({ title: 'Umyć auto', due: d(20) }),
      t({ title: 'Przeczytać artykuł o śnie' }),
      t({ title: 'Kupić baterie do pilota', status: 'inbox' }),
      t({ title: 'pomysł: rower w weekend?', status: 'inbox' }),
      t({ title: 'Zrobić przegląd subskrypcji', status: 'inbox' }),
      t({ title: 'Wynieść śmieci', status: 'done', completedAt: now - 3600_000 }),
    ],
    notes: [
      { id: 'n1', createdAt: now, updatedAt: now, deleted: 0, dirty: 0, title: 'Lista zakupów', body: '- [ ] mleko\n- [x] chleb\n- [ ] **kawa**', taskId: null, tags: [], pinned: true },
      { id: 'n2', createdAt: now, updatedAt: now - 86400000, deleted: 0, dirty: 0, title: 'Pomysły na urlop', body: '## Góry\nBieszczady albo Tatry. *Sprawdzić noclegi.*', taskId: null, tags: [], pinned: false },
    ],
    xp: [0, 1, 2, 4, 5].flatMap((off, i) => [{ id: 'x' + i, createdAt: now - i, updatedAt: now - i, deleted: 0, dirty: 0, amount: 10, reason: 'task', day: d(-off), label: 'Zadanie ' + i }, { id: 'y' + i, createdAt: now - i, updatedAt: now - i, deleted: 0, dirty: 0, amount: 3, reason: 'step', day: d(-off), label: 'Krok ' + i }]),
    dopamine: [],
  },
}
const fixturePath = path.join(out, 'fixture.json')
fs.writeFileSync(fixturePath, JSON.stringify(fixture))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [name, ctxOpts] of [['mobile', devices['Pixel 7']], ['desktop', { viewport: { width: 1280, height: 860 } }]]) {
  const ctx = await browser.newContext({ ...ctxOpts, locale: 'pl-PL', colorScheme: dark ? 'dark' : 'light' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', name, m.text()))
  await page.goto(base + '#/ustawienia')
  await page.setInputFiles('[data-testid=import-input]', fixturePath)
  await page.waitForTimeout(600)
  const shots = [['dzis', '#/dzis'], ['teraz', '#/teraz'], ['inbox', '#/inbox'], ['zadania', '#/zadania/wszystkie'], ['nadchodzace', '#/zadania/nadchodzace'], ['notatki', '#/notatki'], ['notatka', '#/notatki/n1'], ['postepy', '#/postepy'], ['przerwa', '#/przerwa'], ['ustawienia', '#/ustawienia']]
  for (const [s, h] of shots) {
    await page.goto(base + h)
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(out, `${name}-${s}${dark ? '-dark' : ''}.png`), fullPage: s !== 'dzis' })
  }
  await page.goto(base + '#/teraz')
  await page.getByTestId('pick-for-me').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(out, `${name}-teraz-pick${dark ? '-dark' : ''}.png`) })
  await page.goto(base + '#/dzis')
  await page.waitForTimeout(300)
  await page.getByTestId('task-row').nth(1).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(out, `${name}-detail${dark ? '-dark' : ''}.png`) })
  await page.keyboard.press('Escape')
  await page.keyboard.press('n')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(out, `${name}-dump${dark ? '-dark' : ''}.png`) })
  await page.keyboard.press('Escape')
  await page.goto(base + '#/teraz')
  await page.getByText('Zacznij — tylko 5 minut').click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(out, `${name}-focus${dark ? '-dark' : ''}.png`) })
  await ctx.close()
}
await browser.close()
console.log('ok')
