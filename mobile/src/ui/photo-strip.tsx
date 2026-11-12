import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n';

import { AppText } from './text';
import { color, radius, space } from './theme';

/** Řada fotek; klepnutí otevře fotku přes celou obrazovku. S `onRemove` jde fotku odebrat. */
export function PhotoStrip({ photos, onRemove, size = 84 }: { photos: string[]; onRemove?: (i: number) => void; size?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {photos.map((src, i) => (
          <View key={i}>
            <Pressable onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={t('Fotka {0}', i + 1)}>
              <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: radius.sm }} contentFit="cover" />
            </Pressable>
            {onRemove && (
              <Pressable onPress={() => onRemove(i)} style={styles.remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Odebrat fotku')}>
                <AppText variant="caption" color="#fff">
                  ✕
                </AppText>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.full} onPress={() => setOpen(null)} accessibilityLabel={t('Zavřít')}>
          {open != null && <Image source={{ uri: photos[open] }} style={StyleSheet.absoluteFill} contentFit="contain" />}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { flex: 1, backgroundColor: color.bg },
});
