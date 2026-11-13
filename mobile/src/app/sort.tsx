import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dirLabels, parseSort, SORT_FIELDS, type SortDir, type SortField } from '@/core/filters';
import { t } from '@/core/i18n';
import { useFilters } from '@/data/use-portfolio';
import { AppText, color, font, space } from '@/ui';

/** Řazení seznamu – vysouvací panel se seznamem možností */
export default function SortSheet() {
  const [filters, setFilters] = useFilters();
  const cur = parseSort(filters.sort);

  const choose = (field: SortField, dir: SortDir) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setFilters({ ...filters, sort: `${field}-${dir}` });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
      {(Object.keys(SORT_FIELDS) as SortField[]).map((field) => {
        const labels = dirLabels(field);
        return (
          <View key={field} style={styles.row}>
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {t(SORT_FIELDS[field])}
            </AppText>
            {(['desc', 'asc'] as const).map((dir) => {
              const on = cur.field === field && cur.dir === dir;
              return (
                <Pressable key={dir} onPress={() => choose(field, dir)} style={[styles.opt, on && styles.on]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <AppText variant="caption" color={on ? color.text : color.muted} style={{ fontFamily: font.semibold }}>
                    {t(labels[dir])}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  // stejný vzhled jako přepínač (Segmented): kapsle, fialové zvýraznění
  opt: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  on: { backgroundColor: 'rgba(143,107,255,0.28)', boxShadow: 'inset 0 0 0 1px rgba(169,157,255,0.45)' },
});
