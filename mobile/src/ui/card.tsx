import { StyleSheet, View, type ViewProps } from 'react-native';

import { color, radius, space } from './theme';

/** Plocha s jemným okrajem – základní kontejner obsahu */
export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    padding: space.lg,
    gap: space.sm,
  },
});
