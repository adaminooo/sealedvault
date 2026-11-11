import { useState, type FormEvent } from 'react';
import { cloudEnabled, resetPassword, setNewPassword, signIn, signOut, signUp, syncNow, useCloud } from '../lib/cloud';
import { CheckIcon, RefreshIcon } from './icons';
import { LOCALE, t } from '../i18n';

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** Překlad chyb Supabase do srozumitelné češtiny */
function explain(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(m)) return t('Špatný e-mail nebo heslo.');
  if (/email not confirmed/i.test(m)) return t('E-mail ještě není potvrzený – klikni na odkaz, který ti přišel.');
  if (/already registered|already been registered/i.test(m)) return t('Účet s tímto e-mailem už existuje – přihlas se.');
  if (/password should be at least|weak password/i.test(m)) return t('Heslo je moc slabé – použij aspoň 8 znaků.');
  if (/rate limit|too many/i.test(m)) return t('Moc pokusů – zkus to za chvíli znovu.');
  if (/fetch|network/i.test(m)) return t('Nepodařilo se spojit se serverem – zkontroluj internet.');
  return m;
}

const UserIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/** Ikona účtu v hlavičce – tečka ukazuje stav synchronizace */
export function AccountButton({ onOpen }: { onOpen: () => void }) {
  const c = useCloud();
  if (!cloudEnabled) return null;
  const dot = !c.user ? '' : c.error ? 'err' : c.syncing ? 'busy' : 'ok';
  const title = !c.user ? t('Přihlásit se') : c.error ? t('Synchronizace selhala') : c.syncing ? t('Synchronizuji…') : t('Přihlášen: {0}', c.user.email ?? '');
  return (
    <button className={`icon-btn account-btn ${c.user ? 'on' : ''}`} onClick={onOpen} aria-label={title} title={title}>
      {c.user ? <span className="account-initial">{(c.user.email ?? '?').slice(0, 1).toUpperCase()}</span> : <UserIcon />}
      {dot && <i className={`sync-dot ${dot}`} aria-hidden />}
    </button>
  );
}

/** Přihlášení / registrace / zapomenuté heslo */
export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg({ kind: 'error', text: t('Zadej platný e-mail.') });
    if (mode !== 'reset' && password.length < 8) return setMsg({ kind: 'error', text: t('Heslo musí mít aspoň 8 znaků.') });
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        onDone?.();
      } else if (mode === 'signup') {
        const r = await signUp(email.trim(), password);
        if (r.needsConfirm) setMsg({ kind: 'ok', text: t('Hotovo! Poslali jsme ti e-mail – klikni na odkaz v něm a účet se aktivuje.') });
        else onDone?.();
      } else {
        await resetPassword(email.trim());
        setMsg({ kind: 'ok', text: t('Pokud účet existuje, poslali jsme ti e-mail s odkazem pro nastavení nového hesla.') });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: explain(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {mode !== 'reset' && (
        <div className="segmented auth-tabs" role="tablist">
          <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setMsg(null); }}>{t('Přihlásit se')}</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMsg(null); }}>{t('Vytvořit účet')}</button>
        </div>
      )}
      <p className="hint">
        {mode === 'signup'
          ? t('S účtem máš stejné portfolio na počítači i telefonu. Data se přenášejí šifrovaně a vidíš je jen ty.')
          : mode === 'reset'
            ? t('Zadej e-mail účtu – pošleme ti odkaz pro nastavení nového hesla.')
            : t('Přihlas se a tvoje portfolio se sjednotí na všech zařízeních.')}
      </p>
      <label className="field">
        <span>{t('E-mail')}</span>
        <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@email.cz" />
      </label>
      {mode !== 'reset' && (
        <label className="field">
          <span>{t('Heslo')}</span>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? t('aspoň 8 znaků') : ''}
          />
        </label>
      )}
      {msg && <p className={`banner ${msg.kind}`}>{msg.text}</p>}
      <button type="submit" className="btn primary auth-submit" disabled={busy}>
        {busy ? '…' : mode === 'signin' ? t('Přihlásit se') : mode === 'signup' ? t('Vytvořit účet') : t('Poslat odkaz')}
      </button>
      {mode === 'signin' && (
        <button type="button" className="link-btn auth-link" onClick={() => { setMode('reset'); setMsg(null); }}>{t('Zapomněl jsem heslo')}</button>
      )}
      {mode === 'reset' && (
        <button type="button" className="link-btn auth-link" onClick={() => { setMode('signin'); setMsg(null); }}>{t('Zpět na přihlášení')}</button>
      )}
    </form>
  );
}

/** Sekce Účet v Nastavení */
export function AccountSection({ onLogin }: { onLogin: () => void }) {
  const c = useCloud();
  if (!cloudEnabled) return null;
  return (
    <section className="set-group">
      <header>
        <UserIcon />
        <h3>{t('Účet')}</h3>
      </header>
      {c.user ? (
        <>
          <div className="set-row">
            <div>
              <b>{c.user.email}</b>
              <span className={c.error ? 'neg' : ''}>
                {c.error
                  ? t('Synchronizace selhala: {0}', c.error)
                  : c.syncing
                    ? t('Synchronizuji…')
                    : c.lastSync
                      ? t('Synchronizováno v {0} – stejná data na všech zařízeních.', timeFmt.format(new Date(c.lastSync)))
                      : t('Čeká na synchronizaci…')}
              </span>
            </div>
            <button className="btn sm" onClick={() => void syncNow()} disabled={c.syncing}>
              {c.syncing ? <RefreshIcon size={14} className="spin" /> : c.error ? <RefreshIcon size={14} /> : <CheckIcon size={14} />}
              {t('Synchronizovat')}
            </button>
          </div>
          <button className="link-btn" onClick={() => confirm(t('Odhlásit se? Data zůstanou v tomto zařízení.')) && void signOut()}>
            {t('Odhlásit se')}
          </button>
        </>
      ) : (
        <div className="set-row">
          <div>
            <b>{t('Nepřihlášený')}</b>
            <span>{t('Data jsou jen v tomto zařízení. S účtem je máš na počítači i telefonu.')}</span>
          </div>
          <button className="btn sm primary" onClick={onLogin}>{t('Přihlásit se')}</button>
        </div>
      )}
    </section>
  );
}

/** Po kliknutí na odkaz pro obnovu hesla z e-mailu */
export function RecoveryForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setMsg(t('Heslo musí mít aspoň 8 znaků.'));
        setBusy(true);
        try {
          await setNewPassword(password);
          onDone();
        } catch (err) {
          setMsg(explain(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="hint">{t('Zadej nové heslo k účtu.')}</p>
      <label className="field">
        <span>{t('Nové heslo')}</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('aspoň 8 znaků')} />
      </label>
      {msg && <p className="banner error">{msg}</p>}
      <button type="submit" className="btn primary auth-submit" disabled={busy}>{busy ? '…' : t('Uložit heslo')}</button>
    </form>
  );
}
