import { StyleSheet, Text, type TextProps } from 'react-native';

import { color as C, type as T, type TypeVariant } from './theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  /** Čísla se stejnou šířkou číslic (částky v řádcích) */
  tabular?: boolean;
};

/**
 * Text v typografické škále appky.
 * Když vlastní styl zvětší písmo nad výšku řádku varianty, výška řádku se dopočítá
 * (jinak iOS ořízne horní a spodní okraj číslic u velkých částek).
 */
export function AppText({ variant = 'body', color = C.text, tabular, style, ...rest }: Props) {
  const base = T[variant] as { fontSize: number; lineHeight?: number };
  const own = StyleSheet.flatten(style) ?? {};
  const size = (own.fontSize as number | undefined) ?? base.fontSize;
  const line = (own.lineHeight as number | undefined) ?? base.lineHeight;
  const fix = line != null && line < size * 1.2 && own.lineHeight == null ? { lineHeight: Math.ceil(size * 1.22) } : null;
  return <Text {...rest} style={[base, { color }, tabular && { fontVariant: ['tabular-nums'] }, style, fix]} />;
}
