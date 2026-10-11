import { db, notifyLocalChange, table } from './db'
import { SYNC_TABLES, type SyncFields, type TableName } from './types'

export interface BackupFile {
  app: 'ogarniacz'
  version: 1
  exportedAt: string
  data: Record<TableName, Array<SyncFields & Record<string, unknown>>>
}

export async function exportData(): Promise<BackupFile> {
  const data = {} as BackupFile['data']
  for (const t of SYNC_TABLES) {
    data[t] = (await table(t).toArray()).map((r) => ({ ...r, dirty: 0 as const }))
  }
  return { app: 'ogarniacz', version: 1, exportedAt: new Date().toISOString(), data }
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `ogarniacz-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

export async function downloadBackup() {
  const backup = await exportData()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
}

function isRow(r: unknown): r is SyncFields & Record<string, unknown> {
  return !!r && typeof r === 'object' && typeof (r as SyncFields).id === 'string' && typeof (r as SyncFields).updatedAt === 'number'
}

/** Import scala dane (nowsza wersja wygrywa) — nigdy nie kasuje tego, co już masz. */
export async function importData(json: unknown): Promise<ImportResult> {
  const file = json as Partial<BackupFile>
  if (!file || file.app !== 'ogarniacz' || !file.data || typeof file.data !== 'object') {
    throw new Error('To nie wygląda na plik kopii z Ogarniacza.')
  }
  const res: ImportResult = { added: 0, updated: 0, skipped: 0 }
  for (const t of SYNC_TABLES) {
    const rows = (file.data as Record<string, unknown[]>)[t]
    if (!Array.isArray(rows)) continue
    const valid = rows.filter(isRow)
    res.skipped += rows.length - valid.length
    const tb = table(t)
    await db.transaction('rw', tb, async () => {
      const locals = await tb.bulkGet(valid.map((r) => r.id))
      const puts: Array<SyncFields & Record<string, unknown>> = []
      valid.forEach((r, i) => {
        const l = locals[i]
        if (!l) {
          puts.push({ ...r, deleted: r.deleted ? 1 : 0, dirty: 1 })
          res.added++
        } else if (r.updatedAt > l.updatedAt) {
          puts.push({ ...r, deleted: r.deleted ? 1 : 0, dirty: 1 })
          res.updated++
        } else res.skipped++
      })
      if (puts.length) await tb.bulkPut(puts)
    })
  }
  notifyLocalChange()
  return res
}
