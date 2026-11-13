import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './text';
import { color, font, radius } from './theme';

/** Přepínač ve značkovém stylu (fialová kapsle) – období, režimy, řazení */
export function Segmented<T extends string>({ options, value, onChange, stretch }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; stretch?: boolean }) {
  return (
    <View style={[styles.wrap, stretch && { alignSelf: 'stretch' }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (on) return;
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={[styles.btn, stretch && { flex: 1 }, on && styles.on]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}>
            <AppText variant="caption" numberOfLines={1} color={on ? color.text : color.muted} style={{ fontFamily: font.semibold }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, alignItems: 'center' },
  on: { backgroundColor: 'rgba(143,107,255,0.28)', boxShadow: 'inset 0 0 0 1px rgba(169,157,255,0.45)' },
});
