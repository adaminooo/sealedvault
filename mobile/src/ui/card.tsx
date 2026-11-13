import type { ViewProps } from 'react-native';

import { Panel } from './panel';
import { space } from './theme';

/**
 * Základní kontejner obsahu – stejný vzhled jako bloky na hlavní obrazovce a v Analýze
 * (přechodový okraj, tmavý přechod). Jednotný pro všechny obrazovky.
 */
export function Card({ style, children }: ViewProps) {
  return <Panel style={[{ gap: space.sm }, style]}>{children}</Panel>;
}
