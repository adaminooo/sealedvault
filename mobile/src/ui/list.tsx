import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './icon';
import { Panel } from './panel';
import { AppText } from './text';
import { color, space } from './theme';

type IconProps = ComponentProps<typeof Icon>;

/** Skupina řádků jako v systémovém Nastavení: nadpis, zaoblený blok, poznámka pod ním */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: space.sm }}>
      {title ? (
        <AppText variant="overline" color={color.muted} style={{ paddingHorizontal: space.xs }}>
          {title}
        </AppText>
      ) : null}
      <Panel padded={false}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.divider} />}
            {r}
          </View>
        ))}
      </Panel>
      {footer ? (
        <AppText variant="caption" color={color.faint} style={{ paddingHorizontal: space.xs }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

/** Řádek s barevnou ikonou, textem a volitelným prvkem vpravo (přepínač, hodnota, šipka) */
export function Row({
  sf,
  md,
  tint = color.accent,
  title,
  subtitle,
  right,
  onPress,
  chevron,
  destructive,
}: {
  sf: IconProps['sf'];
  md: IconProps['md'];
  tint?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: color.surface2 }]}>
      <View style={[styles.iconTile, { backgroundColor: tint }]}>
        <Icon sf={sf} md={md} size={15} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="body" color={destructive ? color.neg : color.text} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={color.muted} numberOfLines={3}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron && <Icon sf="chevron.right" md="chevron-right" size={13} color={color.faint} />}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 52 },
  iconTile: { width: 28, height: 28, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
