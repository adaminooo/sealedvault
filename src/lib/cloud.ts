import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { PUBLIC_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/**
 * Účty a synchronizace přes Supabase.
 *
 * Data dál žijí v zařízení (IndexedDB) – appka funguje i offline. Každá lokální změna se zapíše
 * do fronty (outbox). Po přihlášení se fronta odesílá na server a stahují se změny z ostatních
 * zařízení. Při konfliktu vyhrává novější změna (čas, kdy ji uživatel udělal).
 */

export type Kind = 'item' | 'wish' | 'settings';
type Row = { kind: Kind; id: string; data: unknown; deleted: boolean; client_at: string; updated_at: string };
type Pending = { kind: Kind; id: string; at: string; deleted: boolean };

export const cloudEnabled = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (client) return client;
  if (!cloudEnabled) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Kam vést odkazy z e-mailů (potvrzení registrace, obnova hesla) */
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
export const AUTH_REDIRECT = isLocal ? PUBLIC_URL : `${location.origin}${import.meta.env.BASE_URL}`;

// ---------- stav (pro UI) ----------
export interface CloudState {
  user: User | null;
  ready: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  /** po kliknutí na odkaz „obnovit heslo“ z e-mailu */
  recovery: boolean;
}
let state: CloudState = { user: null, ready: !cloudEnabled, syncing: false, lastSync: null, error: null, recovery: false };
const listeners = new Set<() => void>();
function setState(p: Partial<CloudState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function useCloud(): CloudState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ---------- fronta lokálních změn ----------
const OUTBOX = 'sv:outbox';
const key = (kind: Kind, id: string) => `${kind}:${id}`;
function readOutbox(): Record<string, Pending> {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? '{}');
  } catch {
    return {};
  }
}
function writeOutbox(o: Record<string, Pending>) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(o));
  } catch {
    /* plné úložiště – zkusí se příště */
  }
}

/** Úložiště hlásí každou lokální změnu (volá IndexedDbStore a sdílená nastavení) */
export function recordChange(kind: Kind, id: string, deleted = false, at = new Date().toISOString()) {
  const o = readOutbox();
  o[key(kind, id)] = { kind, id, at, deleted };
  writeOutbox(o);
  scheduleSync();
}

// ---------- napojení na lokální data (nastaví storage – kvůli cyklickým importům) ----------
export interface LocalAdapter {
  get(kind: 'item' | 'wish', id: string): Promise<unknown | undefined>;
  getAll(kind: 'item' | 'wish'): Promise<{ id: string; updatedAt?: string; createdAt?: string }[]>;
  /** zápis ze serveru – NEzapisuje se do fronty */
  putRaw(kind: 'item' | 'wish', value: unknown): Promise<void>;
  removeRaw(kind: 'item' | 'wish', id: string): Promise<void>;
}
let local: LocalAdapter | null = null;
export function setLocalAdapter(a: LocalAdapter) {
  local = a;
}

/** Sdílená nastavení (localStorage), která se synchronizují */
export const SYNCED_SETTINGS = ['portfolios'] as const;
const settingKey = (id: string) => `tcg-portfolio:${id}`;

// ---------- synchronizace ----------
const lastPullKey = (uid: string) => `sv:lastPull:${uid}`;
const SYNC_USER = 'sv:syncUser';
let timer: number | undefined;
let running: Promise<void> | null = null;
let again = false;

function scheduleSync(delay = 1500) {
  if (!state.user) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

/** Při prvním přihlášení na zařízení: všechna lokální data do fronty (sloučí se s účtem) */
async function enqueueAllLocal() {
  if (!local) return;
  const o = readOutbox();
  for (const kind of ['item', 'wish'] as const) {
    for (const r of await local.getAll(kind)) {
      const k = key(kind, r.id);
      if (!o[k]) o[k] = { kind, id: r.id, at: r.updatedAt ?? r.createdAt ?? new Date(0).toISOString(), deleted: false };
    }
  }
  for (const id of SYNCED_SETTINGS) {
    if (localStorage.getItem(settingKey(id)) != null && !o[key('settings', id)])
      o[key('settings', id)] = { kind: 'settings', id, at: new Date(0).toISOString(), deleted: false };
  }
  writeOutbox(o);
}

async function pull(sb: SupabaseClient, uid: string): Promise<boolean> {
  let since = localStorage.getItem(lastPullKey(uid)) ?? '1970-01-01T00:00:00Z';
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
          if (r.deleted) localStorage.removeItem(settingKey(r.id));
          else localStorage.setItem(settingKey(r.id), JSON.stringify(r.data));
        } catch {
          /* nevadí */
        }
        window.dispatchEvent(new CustomEvent('sv:settings-changed', { detail: r.id }));
      } else if (local) {
        if (r.deleted) await local.removeRaw(r.kind, r.id);
        else if (r.data) await local.putRaw(r.kind, r.data);
      }
      changed = true;
    }
    writeOutbox(o);
    since = rows[rows.length - 1].updated_at;
    localStorage.setItem(lastPullKey(uid), since);
    if (rows.length < 500) break;
  }
  return changed;
}

async function push(sb: SupabaseClient, uid: string) {
  const o = readOutbox();
  const entries = Object.values(o);
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    const rows = [];
    for (const e of chunk) {
      let data: unknown = null;
      let deleted = e.deleted;
      if (!deleted) {
        if (e.kind === 'settings') {
          try {
            data = JSON.parse(localStorage.getItem(settingKey(e.id)) ?? 'null');
          } catch {
            data = null;
          }
        } else data = local ? await local.get(e.kind, e.id) : null;
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
    if (!sb || !uid || !navigator.onLine) return;
    setState({ syncing: true, error: null });
    try {
      // první přihlášení na tomto zařízení (nebo jiný účet) → sloučit lokální data s účtem
      if (localStorage.getItem(SYNC_USER) !== uid) {
        localStorage.removeItem(lastPullKey(uid));
        await enqueueAllLocal();
        localStorage.setItem(SYNC_USER, uid);
      }
      const changed = await pull(sb, uid);
      await push(sb, uid);
      if (changed) window.dispatchEvent(new Event('sv:data-changed'));
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
export async function signUp(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error('Účty nejsou nastavené.');
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw error;
  // bez session = je potřeba potvrdit e-mail
  return { needsConfirm: !data.session };
}
export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error('Účty nejsou nastavené.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function resetPassword(email: string) {
  const sb = supabase();
  if (!sb) throw new Error('Účty nejsou nastavené.');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
  if (error) throw error;
}
export async function setNewPassword(password: string) {
  const sb = supabase();
  if (!sb) throw new Error('Účty nejsou nastavené.');
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
  setState({ recovery: false });
}
export async function signOut() {
  await supabase()?.auth.signOut();
}

/** Spustit při startu appky: obnoví přihlášení a hlídá, kdy synchronizovat */
export function initCloud() {
  const sb = supabase();
  if (!sb) return;
  sb.auth.getSession().then(({ data }) => {
    setState({ user: data.session?.user ?? null, ready: true });
    if (data.session) void syncNow();
  });
  sb.auth.onAuthStateChange((event, session) => {
    const prev = state.user?.id;
    setState({ user: session?.user ?? null, ready: true, ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}) });
    if (session && session.user.id !== prev) void syncNow();
  });
  // návrat do appky, znovu online, a každou minutu, když je appka otevřená
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && scheduleSync(200));
  window.addEventListener('online', () => scheduleSync(200));
  window.setInterval(() => document.visibilityState === 'visible' && scheduleSync(0), 60_000);
}

/** Jen pro automatické testy synchronizace (falešný server místo Supabase) */
export const __test = {
  setClient: (c: unknown) => { client = c as SupabaseClient; },
  setUser: (u: unknown) => setState({ user: u as User | null }),
};
