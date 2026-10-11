import { getSettings } from './settings'

/** Model wskazany przez właściciela. */
export const AI_MODEL = 'claude-sonnet-5-5'

export class AiError extends Error {
  constructor(
    message: string,
    public kind: 'no-key' | 'auth' | 'rate' | 'network' | 'refusal' | 'other' = 'other',
  ) {
    super(message)
  }
}

export function hasAiKey() {
  return getSettings().aiKey.trim().length > 0
}

/** SDK ładowany leniwie — apka startuje szybko, a kod AI pobiera się dopiero przy pierwszym użyciu. */
async function client() {
  const key = getSettings().aiKey.trim()
  if (!key) throw new AiError('Brak klucza API. Dodaj go w Ustawieniach → AI.', 'no-key')
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // dangerouslyAllowBrowser dodaje nagłówek `anthropic-dangerous-direct-browser-access: true`.
  // Klucz należy do właściciela i nie opuszcza jego urządzenia (poza wywołaniem API).
  return { Anthropic, c: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 }) }
}

function mapError(e: unknown, Anthropic: typeof import('@anthropic-ai/sdk').default): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AiError('Klucz API nie działa. Sprawdź go w Ustawieniach → AI.', 'auth')
  if (e instanceof Anthropic.RateLimitError) return new AiError('Za dużo zapytań naraz. Spróbuj za minutę.', 'rate')
  if (e instanceof Anthropic.APIConnectionError) return new AiError('Brak połączenia z AI. Sprawdź internet.', 'network')
  if (e instanceof Anthropic.APIError) return new AiError(`AI zwróciło błąd (${e.status ?? '?'}). Spróbuj ponownie.`, 'other')
  return new AiError('Coś poszło nie tak z AI. Spróbuj ponownie.', 'other')
}

const SYSTEM = `Jesteś ciepłym, konkretnym asystentem osoby dorosłej z ADHD. Piszesz po polsku, krótko, w trybie rozkazującym 2. osoby („Otwórz…”, „Napisz…”).
Pomagasz pokonać paraliż startu: dzielisz zadania na fizyczne, widoczne czynności.`

export interface Breakdown {
  steps: Array<{ title: string; minutes: number }>
  totalMinutes: number
  tip: string
}

export async function breakDownTask(title: string, details: string, existingSteps: string[] = []): Promise<Breakdown> {
  const { Anthropic, c } = await client()
  const { z } = await import('zod')
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod')
  const Schema = z.object({
    steps: z.array(z.object({ title: z.string(), minutes: z.number() })),
    totalMinutes: z.number(),
    tip: z.string(),
  })
  const prompt = `Zadanie: „${title}”${details ? `\nSzczegóły: ${details}` : ''}${
    existingSteps.length ? `\nJuż zapisane kroki (nie powtarzaj ich): ${existingSteps.join('; ')}` : ''
  }

Rozbij to zadanie na 3–8 małych kroków, każdy na 2–10 minut.
Zasady:
- Pierwszy krok ma być ŚMIESZNIE łatwy (np. „Otwórz laptopa”, „Weź do ręki długopis”, „Postaw kubek obok zlewu”) — max 2 minuty.
- Każdy krok to jedna konkretna, fizyczna czynność, max ~8 słów, bez numeracji.
- „minutes” to realistyczny czas kroku (liczba całkowita 1–10).
- „totalMinutes” to suma, zaokrąglona w górę do 5.
- „tip” to jedno krótkie, życzliwe zdanie zachęty lub trik na start (bez moralizowania).`
  try {
    const res = await c.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    if (res.stop_reason === 'refusal') throw new AiError('AI nie chce pomóc z tym zadaniem. Spróbuj opisać je inaczej.', 'refusal')
    const out = res.parsed_output
    if (!out || !out.steps.length) throw new AiError('AI nie zwróciło kroków. Spróbuj ponownie.')
    const steps = out.steps
      .map((s) => ({ title: s.title.trim().replace(/^\d+[.)]\s*/, ''), minutes: Math.min(15, Math.max(1, Math.round(s.minutes))) }))
      .filter((s) => s.title)
      .slice(0, 10)
    return { steps, totalMinutes: Math.max(5, Math.ceil(out.totalMinutes / 5) * 5), tip: out.tip }
  } catch (e) {
    throw mapError(e, Anthropic)
  }
}

export interface Estimate {
  minutes: number
  energy: 'low' | 'medium' | 'high'
  reason: string
}

export async function estimateTask(title: string, details: string, steps: string[] = []): Promise<Estimate> {
  const { Anthropic, c } = await client()
  const { z } = await import('zod')
  const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod')
  const Schema = z.object({
    minutes: z.number(),
    energy: z.enum(['low', 'medium', 'high']),
    reason: z.string(),
  })
  const prompt = `Zadanie: „${title}”${details ? `\nSzczegóły: ${details}` : ''}${steps.length ? `\nKroki: ${steps.join('; ')}` : ''}

Oszacuj realistycznie, ile minut zajmie to osobie z ADHD (z uwzględnieniem rozruchu i przerw, ale bez katastrofizowania).
„minutes”: liczba całkowita (zaokrąglij do 5).
„energy”: ile energii psychicznej wymaga start i wykonanie: low / medium / high.
„reason”: jedno krótkie zdanie po polsku, dlaczego tyle.`
  try {
    const res = await c.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    if (res.stop_reason === 'refusal') throw new AiError('AI nie chce pomóc z tym zadaniem.', 'refusal')
    const out = res.parsed_output
    if (!out) throw new AiError('AI nie zwróciło oszacowania. Spróbuj ponownie.')
    return { minutes: Math.max(5, Math.round(out.minutes / 5) * 5), energy: out.energy, reason: out.reason }
  } catch (e) {
    throw mapError(e, Anthropic)
  }
}

/** Najtańszy test klucza — zwraca null, gdy działa, albo komunikat błędu. */
export async function testAiKey(): Promise<string | null> {
  const { Anthropic, c } = await client()
  try {
    await c.messages.create({ model: AI_MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'Odpowiedz jednym słowem: OK' }] })
    return null
  } catch (e) {
    return mapError(e, Anthropic).message
  }
}
