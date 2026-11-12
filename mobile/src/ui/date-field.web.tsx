import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './text';
import { color, space } from './theme';

/** Webový náhled appky – prohlížečový výběr data */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  return (
    <View style={styles.row}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      {createElement('input', {
        type: 'date',
        value,
        max: new Date().toISOString().slice(0, 10),
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: { background: color.surface2, color: color.text, border: 'none', borderRadius: 12, padding: '8px 12px', colorScheme: 'dark', font: 'inherit' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
