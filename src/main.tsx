import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PremiumProvider } from './lib/premium';
import { registerSW } from 'virtual:pwa-register';
import { initCloud } from './lib/cloud';
import { SharedView } from './components/SharedView';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './index.css';

// Aktualizace appky: nová verze se stáhne na pozadí a appka se sama obnoví.
// Kontrola při spuštění, při návratu do appky (telefon) a každou hodinu.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  },
  onNeedRefresh() {
    updateSW(true);
  },
});

// účty a synchronizace (když je Supabase nastavená)
if (!location.hash.startsWith('#s=')) initCloud();

// …#s=<data> = sdílené portfolio (jen ke čtení), jinak appka
const shared = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shared ? <SharedView code={shared[1]} /> : <PremiumProvider><App /></PremiumProvider>}</StrictMode>,
);
