import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { LANG, t } from '@/core/i18n';

import { supabase } from './cloud';

/**
 * Cenové alerty jako push notifikace. Vyhodnocuje je server (Edge Function price-alerts) jednou denně,
 * takže přijdou i se zavřenou appkou. Appka jen uloží token telefonu k účtu (tabulka push_tokens).
 */
const KEY = 'sv:push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let current: string | null = globalThis.localStorage?.getItem(KEY) ?? null;
const listeners = new Set<() => void>();
const set = (v: string | null) => {
  current = v;
  try {
    if (v) globalThis.localStorage?.setItem(KEY, v);
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* nevadí */
  }
  listeners.forEach((l) => l());
};

/** Jsou upozornění v tomto telefonu zapnutá? */
export function usePushEnabled() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => !!current,
  );
}

const projectId = () => (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Zapne upozornění: povolení od systému, token telefonu, uložení k účtu */
export async function enablePush(): Promise<void> {
  if (Platform.OS === 'web') throw new Error(t('Upozornění fungují jen v appce v telefonu.'));
  if (!Device.isDevice) throw new Error(t('Upozornění fungují jen na skutečném telefonu.'));
  const { data: session } = await supabase().auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error(t('Upozornění chodí k účtu – nejdřív se přihlas.'));
  const pid = projectId();
  if (!pid) throw new Error(t('Upozornění zatím nejsou v této verzi appky nastavená.'));

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: t('Cenové alerty'), importance: AndroidImportance.DEFAULT });
  }
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) throw new Error(t('Notifikace nejsou povolené – zapni je v Nastavení telefonu.'));

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
  const { error } = await supabase()
    .from('push_tokens')
    .upsert({ token, user_id: uid, platform: Platform.OS === 'ios' ? 'ios' : 'android', lang: LANG, updated_at: new Date().toISOString() });
  if (error) throw error;
  set(token);
}

/** Vypne upozornění (smaže token z účtu) */
export async function disablePush(): Promise<void> {
  if (current) await supabase().from('push_tokens').delete().eq('token', current);
  set(null);
}

/** Při odhlášení / smazání účtu – token už k účtu nepatří */
export function forgetPush() {
  set(null);
}

/** Klepnutí na notifikaci otevře produkt / wishlist (adresa je v datech notifikace) */
export function usePushNavigation() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
