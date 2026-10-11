import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('./#/dzis')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('zrzut myśli → zadanie → ukończenie (z XP i cofnięciem)', async ({ page }) => {
  await page.keyboard.press('n')
  const input = page.getByTestId('dump-input')
  await expect(input).toBeFocused()
  await input.fill('Kupić kawę')
  await input.press('Enter')
  await expect(page.getByText('Zapisane w Inboxie')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('./#/inbox')
  await expect(page.getByTestId('inbox-item')).toHaveCount(1)
  await page.getByTestId('triage-today').click()
  await expect(page.getByTestId('inbox-item')).toHaveCount(0)

  await page.goto('./#/dzis')
  const row = page.getByTestId('task-row').filter({ hasText: 'Kupić kawę' })
  await expect(row).toBeVisible()
  await row.getByRole('checkbox').click()
  await expect(page.getByTestId('xp-chip')).toContainText('XP')
  await expect(page.getByText('Zrobione dziś 🎉')).toBeVisible()

  // cofnięcie przywraca zadanie
  await page.getByTestId('toast-action').first().click()
  await expect(page.getByTestId('task-row').filter({ hasText: 'Kupić kawę' }).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
})

test('wiele linii w zrzucie = wiele wpisów; przesunięcie do kosza z cofnięciem', async ({ page }) => {
  await page.keyboard.press('n')
  await page.getByTestId('dump-input').fill('pierwsza\ndruga\ntrzecia')
  await page.getByTestId('dump-save').click()
  await page.keyboard.press('Escape')
  await page.goto('./#/inbox')
  await expect(page.getByTestId('inbox-item')).toHaveCount(3)
  await page.getByTestId('triage-trash').first().click()
  await expect(page.getByTestId('inbox-item')).toHaveCount(2)
  await page.getByTestId('toast-action').last().click()
  await expect(page.getByTestId('inbox-item')).toHaveCount(3)
})

test('Co teraz? wybiera jedną rzecz', async ({ page }) => {
  await page.goto('./#/zadania/wszystkie')
  await page.getByTestId('quick-add').fill('Jedyne zadanie')
  await page.getByTestId('quick-add').press('Enter')
  await page.goto('./#/teraz')
  await page.getByTestId('pick-for-me').click()
  await expect(page.getByTestId('now-card')).toContainText('Jedyne zadanie')
})

test('eksport i import JSON', async ({ page }) => {
  await page.goto('./#/zadania/wszystkie')
  await page.getByTestId('quick-add').fill('Do kopii')
  await page.getByTestId('quick-add').press('Enter')
  await page.goto('./#/ustawienia')
  const dl = page.waitForEvent('download')
  await page.getByTestId('export').click()
  const file = path.join(os.tmpdir(), `ogarniacz-${Date.now()}.json`)
  await (await dl).saveAs(file)
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(json.app).toBe('ogarniacz')
  expect(json.data.tasks.some((t: { title: string }) => t.title === 'Do kopii')).toBe(true)

  // świeży profil: import przywraca dane
  await page.evaluate(() => indexedDB.deleteDatabase('ogarniacz'))
  await page.reload()
  await page.goto('./#/ustawienia')
  await page.getByTestId('import-input').setInputFiles(file)
  await expect(page.getByText(/Zaimportowano/)).toBeVisible()
  await page.goto('./#/zadania/wszystkie')
  await expect(page.getByTestId('task-row').filter({ hasText: 'Do kopii' })).toBeVisible()
})

test('działa offline po pierwszym wczytaniu (service worker)', async ({ page, context }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('n')
  await page.getByTestId('dump-input').fill('Myśl offline')
  await page.getByTestId('dump-input').press('Enter')
  await expect(page.getByText('Zapisane w Inboxie')).toBeVisible()
  await context.setOffline(false)
})
