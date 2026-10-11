-- ============================================================
--  Ogarniacz — jednorazowa konfiguracja bazy Supabase
--  Wklej CAŁOŚĆ w: Supabase → SQL Editor → New query → Run.
--  Skrypt jest idempotentny — można go uruchomić ponownie bez szkody.
-- ============================================================

-- 1) Rekordy synchronizowane z apki (zadania, notatki, XP, menu przerw)
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null check (tbl in ('tasks', 'notes', 'xp', 'dopamine')),
  id text not null,
  data jsonb not null,
  updated_at bigint not null,               -- czas zmiany na urządzeniu (ms), podstawa last-write-wins
  deleted boolean not null default false,   -- soft delete
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, tbl, id)
);

create index if not exists records_pull_idx on public.records (user_id, server_updated_at);
create index if not exists records_remind_idx on public.records ((data ->> 'remindAt')) where tbl = 'tasks' and deleted = false;

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
create policy "records_select_own" on public.records for select to authenticated using (user_id = (select auth.uid()));
create policy "records_insert_own" on public.records for insert to authenticated with check (user_id = (select auth.uid()));
create policy "records_update_own" on public.records for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- celowo brak polityki DELETE: usuwanie = deleted=true

-- Strażnik last-write-wins: starsza wersja nie nadpisze nowszej, nawet gdy dwa urządzenia piszą naraz.
create or replace function public.records_lww_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- pomiń zapis
    end if;
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_lww on public.records;
create trigger records_lww before insert or update on public.records
for each row execute function public.records_lww_guard();

-- 2) Subskrypcje Web Push (jedna na urządzenie/przeglądarkę)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  tz_offset int,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 3) Dziennik wysłanych przypomnień (tylko serwer) — każde przypomnienie wysyłane raz
create table if not exists public.reminders_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  record_id text not null,
  remind_at text not null,
  sent_at timestamptz not null default now(),
  primary key (record_id, remind_at)
);
alter table public.reminders_sent enable row level security;
revoke all on public.reminders_sent from anon, authenticated;

-- 3b) Przypomnienia do wysłania: termin minął (max 6 h temu), jeszcze nie wysłane. Wywołuje tylko funkcja Edge (service role).
create or replace function public.due_reminders(max_rows int default 200)
returns table (user_id uuid, id text, title text, remind_at text)
language sql stable security definer set search_path = '' as $$
  select r.user_id, r.id, r.data ->> 'title', r.data ->> 'remindAt'
  from public.records r
  where r.tbl = 'tasks'
    and not r.deleted
    and coalesce(r.data ->> 'status', '') <> 'done'
    and r.data ->> 'remindAt' <= to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    and r.data ->> 'remindAt' >= to_char((now() - interval '6 hours') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    and not exists (
      select 1 from public.reminders_sent s
      where s.record_id = r.id and s.remind_at = r.data ->> 'remindAt'
    )
  order by r.data ->> 'remindAt'
  limit max_rows;
$$;
revoke execute on function public.due_reminders(int) from public, anon, authenticated;
grant execute on function public.due_reminders(int) to service_role;

-- 4) Sekrety serwera (klucze VAPID, sekret crona) — RLS bez polityk = niedostępne dla klientów
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (key, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- 5) Co minutę: wywołaj funkcję Edge „push”, która wyśle zaległe przypomnienia
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'ogarniacz-push',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpalciokigpaqfprgczv.supabase.co/functions/v1/push?action=cron',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);

-- Sprawdzenie: powinno zwrócić 4 tabele
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('records', 'push_subscriptions', 'reminders_sent', 'app_secrets');
