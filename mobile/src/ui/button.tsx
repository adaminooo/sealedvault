import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { AppText } from './text';
import { color, gradient, radius, space } from './theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary';
};

/** Hlavní tlačítko (značkový přechod) a vedlejší (tmavá plocha) */
export function Button({ label, variant = 'primary', onPress, style, ...rest }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPress={(e) => {
        if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={(s) => [styles.base, !primary && styles.secondary, s.pressed && styles.pressed, typeof style === 'function' ? style(s) : style]}>
      {primary && (
        <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <AppText variant="bodyStrong" color={primary ? '#fff' : color.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  secondary: {
    backgroundColor: color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
