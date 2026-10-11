# PLAN — Planer ADHD („Ogarniacz”)

Kamienie milowe w kolejności. Każdy kończy się commitem + pushem na `main` (i gałąź roboczą).

## M0 — Fundament i wdrożenie
- [x] Szkielet Vite + React + TS + Tailwind v4
- [x] PWA (manifest, ikony, service worker, offline)
- [x] Workflow GitHub Actions → GitHub Pages
- [x] PLAN/PROGRESS/DECISIONS/RANO_ZROB_TO
- [x] Sprawdzenie, że strona na Pages się ładuje

## M1 — Dane lokalne i rdzeń
- [x] Dexie: tabele tasks, notes, xp, meta
- [x] Brain dump (FAB + skrót `N`/`Ctrl+K`), zapis < 2 s, wiele linii = wiele wpisów
- [x] Inbox: przerzucanie na zadanie/notatkę/kosz, gesty swipe, undo
- [x] Zadania: pola opcjonalne, kroki, tagi/projekt, widoki Dziś/Nadchodzące/Wszystkie/Ukończone
- [x] Zaległe pokazywane łagodnie („przenieść na dziś?”)
- [x] Undo dla usunięcia i ukończenia (toast)

## M2 — „Co teraz?” i fokus
- [x] Widok jednej rzeczy + „nie wiem od czego zacząć” (energia + czas)
- [x] Wizualny timer fokusu (smaczek)

## M3 — Notatki
- [x] Lista + wyszukiwanie, prosty markdown, podpinanie do zadania

## M4 — Grywalizacja bez winy
- [x] XP, poziomy, łagodne serie z dniem wolnym, konfetti, dźwięk (wyłączalny)
- [x] Słoik sukcesów (smaczek)

## M5 — Sync z Supabase
- [x] SQL: tabela records + RLS + LWW trigger + push_subscriptions + cron
- [x] Magic link + kod OTP, sync w tle (push dirty / pull po server_updated_at)

## M6 — Przypomnienia
- [x] Lokalne powiadomienia (apka otwarta)
- [x] Web Push: Edge Function + pg_cron + VAPID, instrukcja iOS

## M7 — AI
- [x] Klucz w ustawieniach (lokalnie), „rozbij na kroki”, „oszacuj czas”

## M8 — Smaczki z researchu + Ustawienia
- [x] Smaczki z RESEARCH.md
- [x] Eksport/import JSON, motyw, konto, AI, powiadomienia

## M9 — Testy i szlif
- [x] Vitest (sync, grywalizacja, filtrowanie, wybór zadania)
- [x] Playwright e2e (dump → zadanie → ukończenie; offline; import/eksport)
- [x] Zrzuty ekranu telefon/desktop, poprawki UX
- [x] README, RANO_ZROB_TO, podsumowanie
