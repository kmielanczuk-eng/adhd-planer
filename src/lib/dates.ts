/** Wszystkie „dni” trzymamy jako lokalne YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000)
}

export function today(): string {
  return dayKey()
}

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

export function weekdayName(key: string): string {
  return WEEKDAYS[parseDay(key).getDay()]
}

/** Przyjazny opis dnia: „dziś”, „jutro”, „wczoraj”, „w piątek”, „12 lis”. Bez „ZALEGŁE”. */
export function humanDay(key: string, ref: string = today()): string {
  const diff = diffDays(key, ref)
  if (diff === 0) return 'dziś'
  if (diff === 1) return 'jutro'
  if (diff === -1) return 'wczoraj'
  if (diff > 1 && diff < 7) return weekdayName(key)
  const d = parseDay(key)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function nextWeekend(ref: string = today()): string {
  const d = parseDay(ref)
  const dow = d.getDay()
  if (dow === 6 || dow === 0) return ref
  return addDays(ref, 6 - dow)
}

export function formatMinutes(min: number | null | undefined): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function humanDateTime(iso: string): string {
  const d = new Date(iso)
  return `${humanDay(dayKey(d))}, ${formatTime(d)}`
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Późna noc'
  if (h < 12) return 'Dzień dobry'
  if (h < 18) return 'Cześć'
  return 'Dobry wieczór'
}

/** Polska odmiana: plural(1,'myśl','myśli','myśli'), plural(5,'dzień','dni','dni'). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const d = n % 10
  const t = n % 100
  if (d >= 2 && d <= 4 && !(t >= 12 && t <= 14)) return few
  return many
}
