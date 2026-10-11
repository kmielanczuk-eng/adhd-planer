# PLAN — Planer ADHD („Ogarniacz”)

Kamienie milowe w kolejności. Każdy kończy się commitem + pushem na `main` (i gałąź roboczą).

## M0 — Fundament i wdrożenie
- [ ] Szkielet Vite + React + TS + Tailwind v4
- [ ] PWA (manifest, ikony, service worker, offline)
- [ ] Workflow GitHub Actions → GitHub Pages
- [ ] PLAN/PROGRESS/DECISIONS/RANO_ZROB_TO
- [ ] Sprawdzenie, że strona na Pages się ładuje

## M1 — Dane lokalne i rdzeń
- [ ] Dexie: tabele tasks, notes, xp, meta
- [ ] Brain dump (FAB + skrót `N`/`Ctrl+K`), zapis < 2 s, wiele linii = wiele wpisów
- [ ] Inbox: przerzucanie na zadanie/notatkę/kosz, gesty swipe, undo
- [ ] Zadania: pola opcjonalne, kroki, tagi/projekt, widoki Dziś/Nadchodzące/Wszystkie/Ukończone
- [ ] Zaległe pokazywane łagodnie („przenieść na dziś?”)
- [ ] Undo dla usunięcia i ukończenia (toast)

## M2 — „Co teraz?” i fokus
- [ ] Widok jednej rzeczy + „nie wiem od czego zacząć” (energia + czas)
- [ ] Wizualny timer fokusu (smaczek)

## M3 — Notatki
- [ ] Lista + wyszukiwanie, prosty markdown, podpinanie do zadania

## M4 — Grywalizacja bez winy
- [ ] XP, poziomy, łagodne serie z dniem wolnym, konfetti, dźwięk (wyłączalny)
- [ ] Słoik sukcesów (smaczek)

## M5 — Sync z Supabase
- [ ] SQL: tabela records + RLS + LWW trigger + push_subscriptions + cron
- [ ] Magic link + kod OTP, sync w tle (push dirty / pull po server_updated_at)

## M6 — Przypomnienia
- [ ] Lokalne powiadomienia (apka otwarta)
- [ ] Web Push: Edge Function + pg_cron + VAPID, instrukcja iOS

## M7 — AI
- [ ] Klucz w ustawieniach (lokalnie), „rozbij na kroki”, „oszacuj czas”

## M8 — Smaczki z researchu + Ustawienia
- [ ] Smaczki z RESEARCH.md
- [ ] Eksport/import JSON, motyw, konto, AI, powiadomienia

## M9 — Testy i szlif
- [ ] Vitest (sync, grywalizacja, filtrowanie, wybór zadania)
- [ ] Playwright e2e (dump → zadanie → ukończenie; offline; import/eksport)
- [ ] Zrzuty ekranu telefon/desktop, poprawki UX
- [ ] README, RANO_ZROB_TO, podsumowanie
