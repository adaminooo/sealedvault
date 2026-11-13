import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { date as fmtDate } from '@/core/format';

import { AppText } from './text';
import { color, radius, space } from './theme';

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

/** Datum (YYYY-MM-DD) – systémový kalendář: na iOS kompaktní, na Androidu dialog */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      <View style={styles.row}>
        <AppText variant="label" color={color.muted}>
          {label}
        </AppText>
        <DateTimePicker
          value={fromIso(value)}
          mode="date"
          display="compact"
          maximumDate={new Date()}
          themeVariant="dark"
          accentColor={color.accent}
          onValueChange={(_e, d) => onChange(toIso(d))}
        />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <AppText variant="label" color={color.muted}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        style={styles.btn}
        onPress={() =>
          DateTimePickerAndroid.open({ value: fromIso(value), mode: 'date', maximumDate: new Date(), onValueChange: (_e, d) => onChange(toIso(d)) })
        }>
        <AppText variant="bodyStrong">{fmtDate(value)}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  btn: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
});
