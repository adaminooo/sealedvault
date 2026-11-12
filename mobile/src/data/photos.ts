import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { t } from '@/core/i18n';

/** Stejně jako web: max. 8 fotek na nákup, zmenšené na 1024 px, JPEG v záznamu (data URL) */
export const MAX_PHOTOS = 8;

async function compress(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${out.base64}`;
}

/**
 * Vyfotí nebo vybere fotky a vrátí je jako zmenšené data URL.
 * Fotky se ukládají do záznamu stejně jako na webu, takže se synchronizují a web je zobrazí beze změn.
 */
export async function pickPhotos(source: 'camera' | 'library', room: number): Promise<string[]> {
  if (room <= 0) return [];
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === 'camera' ? t('Appka nemá přístup k fotoaparátu – povol ho v Nastavení telefonu.') : t('Appka nemá přístup k fotkám – povol ho v Nastavení telefonu.'));
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets.slice(0, room)) out.push(await compress(a.uri));
  return out;
}
