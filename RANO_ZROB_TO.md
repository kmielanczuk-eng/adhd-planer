# ☕ RANO ZRÓB TO (ok. 5 minut)

**Apka już działa:** https://kmielanczuk-eng.github.io/adhd-planer/
Bez poniższych kroków działa w pełni **lokalnie** (offline, na jednym urządzeniu). Kroki włączają synchronizację między urządzeniami i powiadomienia push.

> Dlaczego nie zrobiłem tego sam: kontener tej sesji blokuje bezpośrednie połączenia z bazą (port Postgresa), a `SUPABASE_ACCESS_TOKEN` nie był ustawiony. Nic nie jest zepsute — brakuje tylko jednorazowej konfiguracji.

## 1. Baza danych (2 min) — wymagane do synchronizacji

1. Otwórz https://supabase.com/dashboard/project/rpalciokigpaqfprgczv/sql/new
2. Skopiuj **całą** zawartość pliku [`supabase/setup.sql`](supabase/setup.sql) (na GitHubie: przycisk „Copy raw file”).
3. Wklej → **Run**. Na dole powinny pojawić się 4 tabele: `records`, `push_subscriptions`, `reminders_sent`, `app_secrets`.

## 2. Adres logowania (1 min) — wymagane, żeby link z maila wracał do apki

1. Otwórz https://supabase.com/dashboard/project/rpalciokigpaqfprgczv/auth/url-configuration
2. **Site URL**: `https://kmielanczuk-eng.github.io/adhd-planer/`
3. **Redirect URLs** → Add URL: `https://kmielanczuk-eng.github.io/adhd-planer/**` → Save.

## 3. Funkcja powiadomień push (2 min) — wymagane do przypomnień przy zamkniętej apce

**Wariant A (przeglądarka, bez instalowania niczego):**
1. https://supabase.com/dashboard/project/rpalciokigpaqfprgczv/functions → **Deploy a new function** → **Via Editor**.
2. Nazwa funkcji: `push` (dokładnie tak).
3. Wklej całą zawartość [`supabase/functions/push/index.ts`](supabase/functions/push/index.ts) → **Deploy**.
4. W ustawieniach funkcji (Details/Settings) **wyłącz „Enforce JWT verification”** (Verify JWT = off) → Save.
   (Funkcja sama sprawdza uprawnienia — szczegóły w DECISIONS.md pkt 11.)
5. Test: otwórz https://rpalciokigpaqfprgczv.supabase.co/functions/v1/push?action=vapid — ma się pokazać `{"publicKey":"…"}`.

**Wariant B (automat przez GitHub Actions — robi kroki 1 i 3 za ciebie):**
1. Utwórz token: https://supabase.com/dashboard/account/tokens
2. W repo: Settings → Secrets and variables → Actions → New repository secret:
   - `SUPABASE_ACCESS_TOKEN` = token z punktu 1
   - `SUPABASE_DB_PASSWORD` = hasło do bazy
3. Actions → „Wdrożenie Supabase (baza + funkcja push)” → **Run workflow**. (Krok 2 — adres logowania — i tak trzeba kliknąć ręcznie.)

## 4. Opcjonalnie: kod w mailu (przydatne na iPhonie)

Na iPhonie apka dodana do ekranu głównego ma osobną pamięć od Safari, więc link z maila zaloguje cię w Safari, a nie w apce. Rozwiązanie: logowanie **kodem**.
1. https://supabase.com/dashboard/project/rpalciokigpaqfprgczv/auth/templates → **Magic Link**.
2. Dopisz w treści np.: `<p>Twój kod: <strong>{{ .Token }}</strong></p>` → Save.
Apka po wysłaniu linku pokazuje pole „Kod z maila”.

## 5. Opcjonalnie: AI

Ustawienia → AI → wklej klucz `sk-ant-…` z https://console.anthropic.com/settings/keys. Klucz zostaje tylko na urządzeniu.

---
Budziki: sesja miała narzędzie do planowania wznowień (`send_later`), więc praca była wznawiana automatycznie.
