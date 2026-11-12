import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from './text';
import { color, font, radius, space } from './theme';

/** Textové pole s popiskem nad sebou */
export function Field({ label, hint, style, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      <TextInput placeholderTextColor={color.faint} selectionColor={color.accent} keyboardAppearance="dark" {...rest} style={[styles.input, style]} />
      {hint ? (
        <AppText variant="caption" color={color.faint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  input: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    paddingHorizontal: space.md + 2,
    color: color.text,
    fontFamily: font.body,
    fontSize: 16,
  },
});
