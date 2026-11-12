import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import { Backdrop } from './backdrop';
import { color, space } from './theme';

/** Posuvná obrazovka – obsah pod průhlednou hlavičkou i lištou záložek (iOS posune obsah sám) */
export function Screen({ children, contentContainerStyle, backdrop = true, ...rest }: ScrollViewProps & { children: ReactNode; backdrop?: boolean }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...rest}>
      {backdrop && <Backdrop />}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
});
