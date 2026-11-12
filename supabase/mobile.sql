-- SealedVault – doplnění databáze pro mobilní appku (Supabase → SQL Editor → vložit a spustit)
--
-- JEN PŘIDÁNÍ: nic se nemaže, nepřejmenovává ani nemění v tabulce user_data.
-- Lze spustit opakovaně (if not exists / or replace).

-- ---------- Push tokeny telefonů ----------
-- Appka po povolení notifikací uloží token svého zařízení; každý vidí a mění jen svoje.
create table if not exists public.push_tokens (
  token      text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  platform   text        not null check (platform in ('ios', 'android')),
  -- jazyk notifikací (cs / en)
  lang       text        not null default 'cs',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists "vlastni tokeny – cteni" on public.push_tokens;
drop policy if exists "vlastni tokeny – zapis" on public.push_tokens;
drop policy if exists "vlastni tokeny – uprava" on public.push_tokens;
drop policy if exists "vlastni tokeny – mazani" on public.push_tokens;
create policy "vlastni tokeny – cteni"  on public.push_tokens for select using ((select auth.uid()) = user_id);
create policy "vlastni tokeny – zapis"  on public.push_tokens for insert with check ((select auth.uid()) = user_id);
create policy "vlastni tokeny – uprava" on public.push_tokens for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "vlastni tokeny – mazani" on public.push_tokens for delete using ((select auth.uid()) = user_id);

-- ---------- Odeslané cenové alerty ----------
-- Aby stejný alert nechodil každý den znovu. Píše do ní jen serverová funkce price-alerts
-- (RLS zapnuté bez pravidel = z appky nejde číst ani zapisovat).
create table if not exists public.alert_log (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  alert_id text        not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, alert_id)
);
alter table public.alert_log enable row level security;

-- Kdy funkce price-alerts naposledy proběhla (opakované volání v kratším intervalu nic nedělá)
create table if not exists public.alert_runs (
  id         int         primary key default 1 check (id = 1),
  started_at timestamptz not null default now()
);
alter table public.alert_runs enable row level security;

-- ---------- Denní spuštění alertů ----------
-- Každý den v 07:15 UTC (po aktualizaci cen v 06:30) zavolá funkci price-alerts.
-- Volání nese jen veřejný klíč – funkce je bezpečná i při cizím volání
-- (běží nejvýš jednou za 6 h a každý alert pošle jen jednou).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sealedvault-price-alerts')
where exists (select 1 from cron.job where jobname = 'sealedvault-price-alerts');

select cron.schedule(
  'sealedvault-price-alerts',
  '15 7 * * *',
  $$
  select net.http_post(
    url := 'https://xvoosxlqoyrbefvwkdgm.supabase.co/functions/v1/price-alerts',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_HR4b2YUdDFiYGYKqm-gzjw_6kUpkF0w"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
