import { StyleSheet, View } from 'react-native';

import { Icon } from './icon';
import { AppText } from './text';
import { color, radius, space, type Tone } from './theme';

const BG: Record<Tone, string> = { pos: color.posBg, neg: color.negBg, neutral: 'rgba(255,255,255,0.06)' };
const FG: Record<Tone, string> = { pos: color.pos, neg: color.neg, neutral: color.muted };

/** Barevný štítek se šipkou trendu (zisk / ztráta / beze změny) */
export function TrendPill({ tone, label, small }: { tone: Tone; label: string; small?: boolean }) {
  const fg = FG[tone];
  return (
    <View style={[styles.pill, { backgroundColor: BG[tone] }, small && styles.small]}>
      {tone !== 'neutral' && (
        <Icon sf={tone === 'pos' ? 'arrow.up.right' : 'arrow.down.right'} md={tone === 'pos' ? 'north-east' : 'south-east'} size={small ? 11 : 13} color={fg} weight="bold" />
      )}
      <AppText variant={small ? 'caption' : 'label'} tabular color={fg} style={{ fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  small: { paddingHorizontal: 7, paddingVertical: 2 },
});
