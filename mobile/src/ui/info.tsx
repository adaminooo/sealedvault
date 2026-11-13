import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n';

import { Icon } from './icon';
import { AppText } from './text';
import { color, radius, space } from './theme';

/** Stav vysvětlivky: zavřená, dokud uživatel neklepne na ⓘ */
export function useInfo() {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setOpen((o) => !o);
  };
  return { open, toggle };
}

/** Malá ikona ⓘ vedle popisku */
export function InfoButton({ open, onPress, label }: { open: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Vysvětlení: {0}', label)} accessibilityState={{ expanded: open }}>
      <Icon sf={open ? 'info.circle.fill' : 'info.circle'} md={open ? 'info' : 'info-outline'} size={14} color={open ? color.accent2 : color.faint} weight="regular" />
    </Pressable>
  );
}

/** Text vysvětlivky (zobrazí se jen otevřená); klepnutím se zavře */
export function InfoBubble({ open, onClose, text }: { open: boolean; onClose: () => void; text: string }) {
  if (!open) return null;
  return (
    <Pressable onPress={onClose} accessibilityRole="text" style={styles.bubble}>
      <View style={styles.bar} />
      <AppText variant="caption" color={color.muted} style={{ flex: 1, lineHeight: 18 }}>
        {text}
      </AppText>
    </Pressable>
  );
}

/** Popisek s ikonou ⓘ a vysvětlivkou pod ním – pro jednoduché případy */
export function InfoLabel({ label, info, children }: { label: string; info: string; children: (labelRow: React.ReactNode) => React.ReactNode }) {
  const { open, toggle } = useInfo();
  return (
    <>
      {children(
        <View style={styles.row}>
          <AppText variant="caption" color={color.muted}>
            {label}
          </AppText>
          <InfoButton open={open} onPress={toggle} label={label} />
        </View>,
      )}
      <InfoBubble open={open} onClose={toggle} text={info} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bubble: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
    padding: space.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(143,107,255,0.08)',
  },
  bar: { width: 2, borderRadius: 1, backgroundColor: color.accent2, opacity: 0.6 },
});
