import { NativeTabs } from 'expo-router/native-tabs';

import { t } from '@/core/i18n';
import { color } from '@/ui';

/** Spodní lišta záložek – na iOS 26 systémové „liquid glass“, na Androidu Material */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={color.accent} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(portfolio)">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack.3d.up', selected: 'square.stack.3d.up.fill' }} md="inventory_2" />
        <NativeTabs.Trigger.Label>{t('Portfolio')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(analysis)">
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="monitoring" />
        <NativeTabs.Trigger.Label>{t('Analýza')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(wishlist)">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
        <NativeTabs.Trigger.Label>{t('Wishlist')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(account)">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>{t('Účet')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
