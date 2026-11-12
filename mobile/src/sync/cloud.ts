import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { PUBLIC_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { t } from '@/core/i18n';
import { items, setChangeListener, wishlist, type Collection } from '@/db/store';

import { sessionStorage } from './session-storage';

/**
 * Účty a synchronizace přes Supabase – stejný protokol jako web (src/lib/cloud.ts),
 * takže telefon i počítač sdílejí jeden účet a stejná data.
 *
 * Data žijí v telefonu (SQLite) – appka funguje i offline. Každá lokální změna jde do fronty
 * (outbox). Po přihlášení se fronta odešle a stáhnou se změny z ostatních zařízení.
 * Při konfliktu vyhrává novější změna (čas, kdy ji uživatel udělal).
 *
 * Bezpečnost: v appce je jen veřejný klíč; každý vidí jen své řádky (RLS v databázi),
 * přihlášení je uložené v šifrované klíčence systému.
 */

export type Kind = 'item' | 'wish' | 'settings';
type Row = { kind: Kind; id: string; data: unknown; deleted: boolean; client_at: string; updated_at: string };
type Pending = { kind: Kind; id: string; at: string; deleted: boolean };

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Odkazy z e-mailů (potvrzení registrace, obnova hesla) vedou na webovou verzi */
const AUTH_REDIRECT = PUBLIC_URL;

// ---------- stav (pro UI) ----------
export interface CloudState {
  user: User | null;
  ready: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
}
let state: CloudState = { user: null, ready: false, syncing: false, lastSync: null, error: null };
const listeners = new Set<() => void>();
function setState(p: Partial<CloudState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function useCloud(): CloudState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// ---------- fronta lokálních změn ----------
const OUTBOX = 'sv:outbox';
const key = (kind: Kind, id: string) => `${kind}:${id}`;
const ls = () => globalThis.localStorage;
function readOutbox(): Record<string, Pending> {
  try {
    return JSON.parse(ls().getItem(OUTBOX) ?? '{}');
  } catch {
    return {};
  }
}
function writeOutbox(o: Record<string, Pending>) {
  try {
    ls().setItem(OUTBOX, JSON.stringify(o));
  } catch {
    /* zkusí se příště */
  }
}

/** Lokální úložiště hlásí každou změnu (portfolio, wishlist, sdílená nastavení) */
export function recordChange(kind: Kind, id: string, deleted = false, at = new Date().toISOString()) {
  const o = readOutbox();
  o[key(kind, id)] = { kind, id, at, deleted };
  writeOutbox(o);
  scheduleSync();
}
setChangeListener((kind, id, deleted, at) => recordChange(kind, id, deleted, at));

const local: Record<'item' | 'wish', Collection<{ id: string; updatedAt?: string; createdAt?: string }>> = {
  item: items as unknown as Collection<{ id: string }>,
  wish: wishlist as unknown as Collection<{ id: string }>,
};

/** Sdílená nastavení, která se synchronizují (stejné klíče jako web) */
export const SYNCED_SETTINGS = ['portfolios'] as const;
const settingKey = (id: string) => `tcg-portfolio:${id}`;
const settingListeners = new Set<(id: string) => void>();
/** Změna sdíleného nastavení z jiného zařízení */
export function onRemoteSetting(fn: (id: string) => void) {
  settingListeners.add(fn);
  return () => {
    settingListeners.delete(fn);
  };
}

// ---------- synchronizace ----------
const lastPullKey = (uid: string) => `sv:lastPull:${uid}`;
const SYNC_USER = 'sv:syncUser';
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;

function scheduleSync(delay = 1500) {
  if (!state.user) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Při prvním přihlášení na zařízení: všechna lokální data do fronty (sloučí se s účtem) */
async function enqueueAllLocal() {
  const o = readOutbox();
  for (const kind of ['item', 'wish'] as const) {
    for (const r of await local[kind].getAll()) {
      const k = key(kind, r.id);
      if (!o[k]) o[k] = { kind, id: r.id, at: r.updatedAt ?? r.createdAt ?? new Date(0).toISOString(), deleted: false };
    }
  }
  for (const id of SYNCED_SETTINGS) {
    if (ls().getItem(settingKey(id)) != null && !o[key('settings', id)])
      o[key('settings', id)] = { kind: 'settings', id, at: new Date(0).toISOString(), deleted: false };
  }
  writeOutbox(o);
}

async function pull(sb: SupabaseClient, uid: string): Promise<boolean> {
  let since = ls().getItem(lastPullKey(uid)) ?? '1970-01-01T00:00:00Z';
  let changed = false;
  for (;;) {
    const { data, error } = await sb
      .from('user_data')
      .select('kind,id,data,deleted,client_at,updated_at')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    if (!rows.length) break;
    const o = readOutbox();
    for (const r of rows) {
      const k = key(r.kind, r.id);
      const mine = o[k];
      // lokální novější změna vyhrává (odešle se při push)
      if (mine && Date.parse(mine.at) > Date.parse(r.client_at)) continue;
      if (mine) delete o[k];
      if (r.kind === 'settings') {
        if (!(SYNCED_SETTINGS as readonly string[]).includes(r.id)) continue;
        try {
          if (r.deleted) ls().removeItem(settingKey(r.id));
          else ls().setItem(settingKey(r.id), JSON.stringify(r.data));
        } catch {
          /* nevadí */
        }
        settingListeners.forEach((l) => l(r.id));
      } else if (r.kind === 'item' || r.kind === 'wish') {
        if (r.deleted) await local[r.kind].removeRaw(r.id);
        else if (r.data) await local[r.kind].putRaw(r.data as { id: string });
      }
      changed = true;
    }
    writeOutbox(o);
    since = rows[rows.length - 1].updated_at;
    ls().setItem(lastPullKey(uid), since);
    if (rows.length < 500) break;
  }
  return changed;
}

async function push(sb: SupabaseClient, uid: string) {
  const entries = Object.values(readOutbox());
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    const rows = [];
    for (const e of chunk) {
      let data: unknown = null;
      let deleted = e.deleted;
      if (!deleted) {
        if (e.kind === 'settings') {
          try {
            data = JSON.parse(ls().getItem(settingKey(e.id)) ?? 'null');
          } catch {
            data = null;
          }
        } else data = (await local[e.kind].get(e.id)) ?? null;
        if (data == null) deleted = true; // mezitím smazáno
      }
      rows.push({ user_id: uid, kind: e.kind, id: e.id, data: deleted ? null : data, deleted, client_at: e.at });
    }
    const { error } = await sb.from('user_data').upsert(rows, { onConflict: 'user_id,kind,id' });
    if (error) throw error;
    // odeslané položky z fronty pryč (jen pokud se mezitím znovu nezměnily)
    const now = readOutbox();
    for (const e of chunk) if (now[key(e.kind, e.id)]?.at === e.at) delete now[key(e.kind, e.id)];
    writeOutbox(now);
  }
}

/** Odešle lokální změny a stáhne změny z ostatních zařízení */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const sb = supabase();
    const uid = state.user?.id;
    if (!uid) return;
    setState({ syncing: true, error: null });
    try {
      // první přihlášení na tomto zařízení (nebo jiný účet) → sloučit lokální data s účtem
      if (ls().getItem(SYNC_USER) !== uid) {
        ls().removeItem(lastPullKey(uid));
        await enqueueAllLocal();
        ls().setItem(SYNC_USER, uid);
      }
      await pull(sb, uid);
      await push(sb, uid);
      setState({ lastSync: new Date().toISOString() });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setState({ syncing: false });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      scheduleSync(300);
    }
  });
  return running;
}

// ---------- přihlášení ----------
/** Srozumitelná hláška místo technické chyby Supabase */
export function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(m)) return t('Špatný e-mail nebo heslo.');
  if (/email not confirmed/i.test(m)) return t('E-mail ještě není potvrzený – klikni na odkaz, který ti přišel.');
  if (/already registered|already exists/i.test(m)) return t('Účet s tímto e-mailem už existuje – přihlas se.');
  if (/password should be at least|weak password/i.test(m)) return t('Heslo je moc slabé – použij aspoň 8 znaků.');
  if (/rate limit|too many/i.test(m)) return t('Moc pokusů – zkus to za chvíli znovu.');
  if (/network|fetch/i.test(m)) return t('Nepodařilo se spojit se serverem – zkontroluj internet.');
  return m;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw error;
  // bez relace = je potřeba potvrdit e-mail
  return { needsConfirm: !data.session };
}
export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function resetPassword(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
  if (error) throw error;
}
export async function signOut() {
  await supabase().auth.signOut();
}

let started = false;
/** Spustit při startu appky: obnoví přihlášení a hlídá, kdy synchronizovat */
export function initCloud() {
  if (started) return;
  started = true;
  const sb = supabase();
  sb.auth.getSession().then(({ data }) => {
    setState({ user: data.session?.user ?? null, ready: true });
    if (data.session) void syncNow();
  });
  sb.auth.onAuthStateChange((_event, session) => {
    const prev = state.user?.id;
    setState({ user: session?.user ?? null, ready: true });
    if (session && session.user.id !== prev) void syncNow();
  });
  // obnova tokenu jen když je appka v popředí (doporučení Supabase pro mobilní appky)
  let interval: ReturnType<typeof setInterval> | undefined;
  const onState = (s: string) => {
    if (s === 'active') {
      sb.auth.startAutoRefresh();
      scheduleSync(200);
      clearInterval(interval);
      interval = setInterval(() => scheduleSync(0), 60_000);
    } else {
      sb.auth.stopAutoRefresh();
      clearInterval(interval);
    }
  };
  AppState.addEventListener('change', onState);
  onState(AppState.currentState ?? 'active');
}

/** Jen pro automatické testy synchronizace (falešný server místo Supabase) */
export const __test = {
  setClient: (c: unknown) => {
    client = c as SupabaseClient;
  },
  setUser: (u: unknown) => setState({ user: u as User | null }),
  stop: () => clearTimeout(timer),
};
