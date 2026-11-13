import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable } from 'react-native';

import { t } from '@/core/i18n';
import { authMessage, resetPassword, signIn, signUp } from '@/sync/cloud';
import { AppText, Button, Screen, color } from '@/ui';
import { Field } from '@/ui/field';
import { Segmented } from '@/ui/segmented';

type Mode = 'signin' | 'signup' | 'reset';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Přihlášení, registrace a zapomenuté heslo – stejný účet jako na webu */
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    const e = email.trim();
    if (!EMAIL.test(e)) return setError(t('Zadej platný e-mail.'));
    if (mode !== 'reset' && password.length < 8) return setError(t('Heslo musí mít aspoň 8 znaků.'));
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(e, password);
        close();
      } else if (mode === 'signup') {
        const { needsConfirm } = await signUp(e, password);
        if (needsConfirm) setInfo(t('Hotovo! Poslali jsme ti e-mail – klikni na odkaz v něm a účet se aktivuje.'));
        else close();
      } else {
        await resetPassword(e);
        setInfo(t('Pokud účet existuje, poslali jsme ti e-mail s odkazem pro nastavení nového hesla.'));
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <AppText color={color.muted}>
          {mode === 'reset'
            ? t('Zadej e-mail účtu – pošleme ti odkaz pro nastavení nového hesla.')
            : t('S účtem máš stejné portfolio na počítači i telefonu. Data se přenášejí šifrovaně a vidíš je jen ty.')}
        </AppText>

        {mode !== 'reset' && (
          <Segmented
            stretch
            options={[
              { value: 'signin', label: t('Přihlásit se') },
              { value: 'signup', label: t('Vytvořit účet') },
            ]}
            value={mode}
            onChange={switchTo}
          />
        )}

        <Field label={t('E-mail')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
        {mode !== 'reset' && (
          <Field
            label={t('Heslo')}
            hint={mode === 'signup' ? t('aspoň 8 znaků') : undefined}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}

        {error && <AppText color={color.neg}>{error}</AppText>}
        {info && <AppText color={color.pos}>{info}</AppText>}

        {busy ? (
          <ActivityIndicator color={color.accent2} style={{ minHeight: 50 }} />
        ) : (
          <Button label={mode === 'signin' ? t('Přihlásit se') : mode === 'signup' ? t('Vytvořit účet') : t('Poslat odkaz')} onPress={submit} />
        )}

        <Pressable onPress={() => switchTo(mode === 'reset' ? 'signin' : 'reset')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <AppText variant="label" color={color.accent2}>
            {mode === 'reset' ? t('Zpět na přihlášení') : t('Zapomněl jsem heslo')}
          </AppText>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/account');
}
