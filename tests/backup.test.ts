import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/lib/db'
import { exportData, importData } from '../src/lib/backup'
import { createNote, createTask } from '../src/lib/actions'
import { renderMarkdown, toggleCheckboxLine } from '../src/lib/markdown'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('eksport / import', () => {
  it('eksport → wyczyszczenie → import odtwarza dane', async () => {
    await createTask({ title: 'Zadanie 1' })
    await createNote({ title: 'Notatka', body: 'treść' })
    const backup = JSON.parse(JSON.stringify(await exportData()))
    await db.tasks.clear()
    await db.notes.clear()
    const res = await importData(backup)
    expect(res.added).toBe(2)
    expect((await db.tasks.toArray())[0].title).toBe('Zadanie 1')
    expect((await db.tasks.toArray())[0].dirty).toBe(1)
  })
  it('import nie nadpisuje nowszych lokalnych zmian', async () => {
    const t = await createTask({ title: 'stare' })
    const backup = JSON.parse(JSON.stringify(await exportData()))
    await db.tasks.update(t.id, { title: 'nowsze', updatedAt: t.updatedAt + 1000 })
    const res = await importData(backup)
    expect(res.skipped).toBe(1)
    expect((await db.tasks.get(t.id))?.title).toBe('nowsze')
  })
  it('odrzuca obce pliki', async () => {
    await expect(importData({ foo: 1 })).rejects.toThrow()
  })
})

describe('markdown', () => {
  it('escapuje HTML i renderuje formatowanie', () => {
    const html = renderMarkdown('# Tytuł\n**gruby** <script>x</script>\n- [x] zrobione\n- punkt')
    expect(html).toContain('<h1>Tytuł</h1>')
    expect(html).toContain('<strong>gruby</strong>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('checked')
    expect(html).toContain('<li>punkt</li>')
  })
  it('przełącza checkbox', () => {
    expect(toggleCheckboxLine('a\n- [ ] b', 1)).toBe('a\n- [x] b')
    expect(toggleCheckboxLine('- [x] b', 0)).toBe('- [ ] b')
  })
})
