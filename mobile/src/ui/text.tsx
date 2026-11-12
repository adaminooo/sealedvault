import { Text, type TextProps } from 'react-native';

import { color as C, type as T, type TypeVariant } from './theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  /** Čísla se stejnou šířkou číslic (částky v řádcích) */
  tabular?: boolean;
};

/** Text v typografické škále appky */
export function AppText({ variant = 'body', color = C.text, tabular, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[T[variant], { color }, tabular && { fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
