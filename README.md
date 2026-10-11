# 🌿 Ogarniacz — planer dla głowy z ADHD

Prywatny planer, lista zadań i notatnik zrobiony pod ADHD: szybki zrzut myśli, jedna rzecz naraz, łagodne podejście do zaległości i nagrody bez poczucia winy.

**👉 Apka: https://kmielanczuk-eng.github.io/adhd-planer/**

Najpierw zajrzyj do **[RANO_ZROB_TO.md](RANO_ZROB_TO.md)**: to ok. 5 minut jednorazowej konfiguracji synchronizacji i powiadomień.

## Co umie

| | |
|---|---|
| 🧠 **Zrzut myśli** | Przycisk „+” albo klawisz **N** / **Ctrl+K** z każdego miejsca. Nie ma pól do wypełniania, Enter zapisuje, a każda linia to osobny wpis. Okno zostaje otwarte na kolejną myśl. |
| 📥 **Inbox** | Każdy wpis jednym stuknięciem trafia do zadań, na dziś, do notatek albo do kosza. Na telefonie są gesty: przesunięcie w prawo zamienia wpis w zadanie, w lewo wyrzuca go do kosza. Każdy ruch można cofnąć. |
| ✅ **Zadania** | Wymagany jest tylko tytuł. Opcjonalnie: termin, szacowany czas, poziom energii, małe kroki, tagi, projekt, przypomnienie i podpięta notatka. Widoki: Dziś, Nadchodzące, Wszystkie, Ukończone. |
| ⭐ **3 na dziś** | Wybierasz maksymalnie 3 rzeczy na dziś. Limit jest miękki i można go zmienić. |
| 🎯 **Co teraz?** | Pokazuje jedną rzecz. Przycisk „Nie wiem, od czego zacząć” dobiera zadanie do twojej energii i dostępnego czasu. |
| ⏳ **Znikający dysk** | Wizualny timer w stylu Time Timera, który pomaga przy ślepocie czasowej. Daje delikatne sygnały w połowie i przy 80% czasu. Ma przyciski „+5 min” i „Na razie wystarczy”, a przerwanie też liczy się jako sukces. |
| ▶️ **Tylko 5 minut** | Start bez presji. Apka pyta o pierwszy fizyczny ruch, a po 5 minutach daje wybór: „lecę dalej” albo „wystarczy”. |
| 📝 **Notatki** | Prosty markdown (pogrubienie, nagłówki, listy, checkboxy), wyszukiwanie, przypinanie i podpinanie do zadań. |
| 🔔 **Przypomnienia** | Gdy apka jest otwarta, przychodzą jako dymek i powiadomienie systemowe. Gdy jest zamknięta, przychodzą jako Web Push z serwera (Supabase Edge Function + pg_cron). |
| 🫙 **Słoik wygranych** | Każde zadanie, krok i sesja skupienia wrzuca żeton do słoika, więc widać, co już zostało zrobione. |
| 🔥 **XP, poziomy, łagodna seria** | XP nigdy nie spada. Jeden pusty dzień to automatyczny 🌙 dzień wolny, a urlop możesz ogłosić sam. Nie ma kar ani czerwonych zaległości. |
| ☕ **Menu dopaminowe** | Przerwy wybrane zawczasu: przystawki, dania główne, dodatki i desery (desery zawsze z timerem). |
| ✨ **AI** | „Rozbij na małe kroki” (pierwszy krok jest śmiesznie łatwy) i „Oszacuj czas”. Działa z twoim kluczem Anthropic zapisanym tylko na urządzeniu. |
| 💾 **Kopia** | Eksport i import JSON. Import scala dane i nigdy niczego nie kasuje. |
| 🌙 **Motyw** | Jasny, ciemny albo systemowy. Dźwięki, konfetti i animacje da się wyłączyć. |

Wszystko działa **offline**, a dane są przede wszystkim na urządzeniu (IndexedDB). Synchronizacja dzieje się w tle i nigdy nie blokuje ekranu.

## Instalacja

### iPhone / iPad
1. Otwórz link w **Safari**.
2. Stuknij **Udostępnij** (kwadrat ze strzałką) → **„Do ekranu początkowego”** → Dodaj.
3. Uruchamiaj Ogarniacza z ikony. Tylko wtedy działają powiadomienia push (wymagany iOS 16.4+).

### Android
1. Otwórz link w **Chrome**.
2. Menu ⋮ → **„Zainstaluj aplikację”** (albo „Dodaj do ekranu głównego”).

### Komputer (Chrome / Edge)
1. Otwórz link.
2. W pasku adresu kliknij ikonę **instalacji** (monitor ze strzałką) albo Menu → „Zainstaluj Ogarniacz”.

## Synchronizacja między urządzeniami
1. Wykonaj jednorazowo kroki 1 i 2 z [RANO_ZROB_TO.md](RANO_ZROB_TO.md).
2. W apce przejdź do **Ustawienia → Konto i synchronizacja** i wpisz e-mail. Kliknij link z maila (albo wpisz kod, jeśli włączysz go w szablonie maila).
3. Zrób to samo na każdym urządzeniu. Dane same się połączą: dla każdego elementu wygrywa nowsza zmiana.

## Powiadomienia push
1. Wykonaj krok 3 z [RANO_ZROB_TO.md](RANO_ZROB_TO.md).
2. Zaloguj się w apce (sync), a na iPhonie najpierw dodaj apkę do ekranu głównego.
3. **Ustawienia → Powiadomienia → „Włącz push na tym urządzeniu”**, potem „Wyślij testowy push”.
4. W zadaniu przejdź do **Więcej → Przypomnienie** i wybierz np. „Za godzinę”. Serwer sprawdza przypomnienia co minutę.

## AI
**Ustawienia → AI** → wklej klucz z https://console.anthropic.com/settings/keys → „Zapisz i sprawdź”. Potem w szczegółach zadania użyj przycisków „Rozbij to na małe kroki (AI)” albo „Oszacuj (AI)”. Bez klucza apka działa normalnie, a przycisk wyjaśnia, jak go dodać.

## Skróty klawiszowe
- **N** albo **Ctrl/⌘+K**: zrzut myśli
- **G**, a potem **D / T / I / Z / O / P / U**: Dziś, Co teraz?, Inbox, Zadania, nOtatki, Postępy, Ustawienia
- **Esc**: zamknij okno

## Dla programisty
```bash
npm install
npm run dev        # http://localhost:5173/adhd-planer/
npm test           # Vitest: sync, grywalizacja, filtrowanie, eksport/import
npm run build && npx playwright test   # e2e: telefon + desktop
```
- Stack: Vite + React + TypeScript + Tailwind v4 + vite-plugin-pwa + Dexie + Supabase.
- Wdrożenie: push na `main` buduje i publikuje na GitHub Pages (`.github/workflows/deploy.yml`).
- Backend: `supabase/setup.sql` (tabele z RLS, strażnik last-write-wins, cron) i `supabase/functions/push`.
- Decyzje projektowe: [DECISIONS.md](DECISIONS.md). Research: [RESEARCH.md](RESEARCH.md). Plan i postęp: [PLAN.md](PLAN.md), [PROGRESS.md](PROGRESS.md).
