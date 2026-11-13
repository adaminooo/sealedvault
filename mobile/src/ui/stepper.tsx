import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './text';
import { color, radius } from './theme';

/** Počet kusů: − číslo + */
export function Stepper({ value, onChange, min = 1, max = 9999, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  const set = (n: number) => {
    const v = Math.max(min, Math.min(max, n));
    if (v === value) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onChange(v);
  };
  return (
    <View style={styles.row}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      <View style={styles.box} accessibilityRole="adjustable" accessibilityValue={{ now: value, min, max }}>
        <Pressable onPress={() => set(value - 1)} style={styles.btn} hitSlop={6} accessibilityLabel="−" disabled={value <= min}>
          <AppText variant="heading" color={value <= min ? color.faint : color.text}>
            −
          </AppText>
        </Pressable>
        <AppText variant="heading" tabular style={styles.val}>
          {value}
        </AppText>
        <Pressable onPress={() => set(value + 1)} style={styles.btn} hitSlop={6} accessibilityLabel="+" disabled={value >= max}>
          <AppText variant="heading" color={value >= max ? color.faint : color.text}>
            +
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.pill },
  btn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  val: { minWidth: 36, textAlign: 'center' },
});
