import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from './text';
import { color, radius, space } from './theme';

/** Přepínací „chip“ (filtry, výběr portfolia) */
export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && { opacity: 0.75 }]}>
      {icon}
      <AppText variant="label" color={active ? color.text : color.muted}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Vodorovně posuvná řada chipů přes celou šířku obrazovky */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md + 2,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  active: { backgroundColor: color.surface3, borderColor: color.accent },
  row: { marginHorizontal: -space.lg, flexGrow: 0 },
  rowContent: { paddingHorizontal: space.lg, gap: space.sm },
});
