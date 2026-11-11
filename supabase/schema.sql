-- SealedVault – databáze pro účty a synchronizaci (Supabase → SQL Editor → vložit a spustit)
--
-- Jedna tabulka pro všechna data uživatele: položky portfolia, wishlist a nastavení.
-- Každý řádek patří přihlášenému uživateli a díky RLS (row level security)
-- může číst a měnit jen svoje vlastní řádky.

create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('item', 'wish', 'settings')),
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  -- kdy změnu udělal uživatel (čas zařízení) – rozhoduje, která verze je novější
  client_at  timestamptz not null default now(),
  -- kdy změna dorazila na server (nastavuje databáze) – podle toho si zařízení stahují novinky
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists user_data_changes on public.user_data (user_id, updated_at);

-- čas příchodu na server vždy podle serveru (ne podle hodin v telefonu)
create or replace function public.user_data_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before insert or update on public.user_data
  for each row execute function public.user_data_touch();

alter table public.user_data enable row level security;

drop policy if exists "vlastni data – cteni" on public.user_data;
drop policy if exists "vlastni data – zapis" on public.user_data;
drop policy if exists "vlastni data – uprava" on public.user_data;
drop policy if exists "vlastni data – mazani" on public.user_data;

create policy "vlastni data – cteni"  on public.user_data for select using ((select auth.uid()) = user_id);
create policy "vlastni data – zapis"  on public.user_data for insert with check ((select auth.uid()) = user_id);
create policy "vlastni data – uprava" on public.user_data for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "vlastni data – mazani" on public.user_data for delete using ((select auth.uid()) = user_id);
