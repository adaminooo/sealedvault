import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space } from './theme';

/**
 * Karta ve stylu hlavní obrazovky: jemný přechodový okraj (fialová → průhledná → modrá)
 * a tmavé pozadí s přechodem. Jednotný vzhled bloků v celé appce.
 */
export function Panel({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return (
    <LinearGradient colors={['rgba(143,107,255,0.45)', 'rgba(255,255,255,0.05)', 'rgba(79,125,255,0.32)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
      <View style={[styles.card, padded && styles.padded, style]}>
        <LinearGradient colors={['#121219', '#0b0b10']} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: { borderRadius: radius.lg + 4, borderCurve: 'continuous', padding: 1, boxShadow: '0 20px 44px -30px rgba(143,107,255,0.3)' },
  card: { borderRadius: radius.lg + 3, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#0d0d12' },
  padded: { padding: space.lg, gap: space.md },
});
