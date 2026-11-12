import * as SecureStore from 'expo-secure-store';

/**
 * Úložiště přihlášení pro Supabase: šifrovaná klíčenka systému (iOS Keychain / Android Keystore).
 * Jedna hodnota v klíčence má limit ~2 kB, relace bývá delší – ukládá se proto po částech.
 */
const CHUNK = 1800;
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (k: string) => `${safe(k)}.n`;
const partKey = (k: string, i: number) => `${safe(k)}.${i}`;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

async function removeParts(key: string, from = 0) {
  const n = Number((await SecureStore.getItemAsync(countKey(key), opts)) ?? 0);
  for (let i = from; i < n; i++) await SecureStore.deleteItemAsync(partKey(key, i), opts);
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = Number((await SecureStore.getItemAsync(countKey(key), opts)) ?? 0);
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(partKey(key, i), opts);
      if (p == null) return null; // neúplný zápis – jako by nebylo přihlášení
      parts.push(p);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const n = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(partKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    await removeParts(key, n);
    await SecureStore.setItemAsync(countKey(key), String(n), opts);
  },
  async removeItem(key: string): Promise<void> {
    await removeParts(key);
    await SecureStore.deleteItemAsync(countKey(key), opts);
  },
};
