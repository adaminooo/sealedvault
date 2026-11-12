import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import { color, space } from './theme';

/** Posuvná obrazovka – obsah pod průhlednou hlavičkou i lištou záložek (iOS posune obsah sám) */
export function Screen({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...rest}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
});
