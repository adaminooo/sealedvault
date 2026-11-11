import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PremiumProvider } from './lib/premium';
import { SharedView } from './components/SharedView';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './index.css';

// …#s=<data> = sdílené portfolio (jen ke čtení), jinak appka
const shared = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shared ? <SharedView code={shared[1]} /> : <PremiumProvider><App /></PremiumProvider>}</StrictMode>,
);
