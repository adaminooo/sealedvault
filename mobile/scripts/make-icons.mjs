// Vygeneruje ikony mobilní appky z webového loga (../public/logo.svg), stejně jako web (scripts/make-icons.mjs):
// render přes Microsoft Edge v headless režimu. Spuštění v mobile/:  node scripts/make-icons.mjs
//
//  - assets/images/icon.png                    1024 px, plné pozadí (App Store / iOS – Expo při sestavení odstraní průhlednost)
//  - assets/images/android-icon-foreground.png 1024 px, logo v bezpečné zóně adaptivní ikony, průhledné pozadí
//  - assets/images/splash-icon.png             1024 px, logo na průhledném pozadí (úvodní obrazovka)
//  - assets/images/favicon.png                 196 px (webový náhled)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!EDGE) throw new Error('Microsoft Edge nenalezen');

const svg = readFileSync('../public/logo.svg', 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'sealedvault-mobile-icons-'));
const BG = '#0a0a10';

/** scale = jak velkou část plochy logo zabírá; bg = barva pozadí nebo průhledné */
function render(size, scale, bg, out) {
  const inner = Math.round(size * scale);
  const html = `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}">
    ${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`;
  const file = join(tmp, `${out.replace(/[\\/]/g, '_')}.html`);
  writeFileSync(file, html);
  execFileSync(
    EDGE,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${size},${size}`, `--screenshot=${join(process.cwd(), out)}`, pathToFileURL(file).href],
    { stdio: 'ignore' },
  );
}

render(1024, 0.82, BG, 'assets/images/icon.png');
render(1024, 0.6, 'transparent', 'assets/images/android-icon-foreground.png');
render(1024, 1, 'transparent', 'assets/images/splash-icon.png');
render(196, 1, 'transparent', 'assets/images/favicon.png');

console.log('Ikony mobilní appky vygenerovány z ../public/logo.svg');
