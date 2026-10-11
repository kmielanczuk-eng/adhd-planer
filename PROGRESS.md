# PROGRESS

## Zrobione (wszystkie kamienie M0–M9)
- Apka wdrożona: https://kmielanczuk-eng.github.io/adhd-planer/ (manifest, SW, ikony, offline sprawdzone)
- Brain dump, Inbox z gestami, zadania + 4 widoki, „3 na dziś”, łagodne zaległości, undo wszędzie
- „Co teraz?” + Znikający dysk + Tylko 5 minut, notatki (markdown, wyszukiwanie, podpinanie)
- XP/poziomy/łagodna seria/dni wolne, Słoik wygranych, Menu dopaminowe, konfetti + dźwięki
- Sync (Supabase, LWW + soft delete, strażnik w bazie), magic link + kod OTP
- Przypomnienia lokalne + Web Push (funkcja Edge `push`, pg_cron) — kod gotowy, wdrożenie: RANO_ZROB_TO.md
- AI (Anthropic SDK, claude-sonnet-5-5): rozbijanie na kroki, szacowanie czasu
- Ustawienia: motyw, dźwięk, konto, powiadomienia (+instrukcja iOS), AI, eksport/import
- Testy: Vitest 29/29, Playwright e2e 10/10 (telefon + desktop), CI zielone
- README, RANO_ZROB_TO, DECISIONS, RESEARCH

## Blokery (obejście opisane w RANO_ZROB_TO.md)
- Brak połączenia TCP z bazą z kontenera i brak SUPABASE_ACCESS_TOKEN → SQL i funkcję wdraża właściciel (5 min) albo workflow `supabase.yml` po dodaniu sekretów.

## Dalej (runda szlifów)
- przegląd błędów i drobnych UX
