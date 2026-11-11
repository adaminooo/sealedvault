// Vygeneruje ikony appky z public/logo.svg (render přes Microsoft Edge v headless režimu).
// Spuštění: npm run icons   (Windows s nainstalovaným Edge)
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!EDGE) throw new Error('Microsoft Edge nenalezen');

const svg = readFileSync('public/logo.svg', 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'sealedvault-icons-'));

/**
 * mode 'rounded'  – logo se zaoblenými rohy na průhledném pozadí (běžná ikona)
 * mode 'bleed'    – celé pole vyplněné pozadím, logo zmenšené do bezpečné zóny (maskable / iOS)
 */
function render(size, mode, out) {
  const scale = mode === 'bleed' ? 0.82 : 1;
  const inner = Math.round(size * scale);
  const html = `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${mode === 'bleed' ? '#0a0a10' : 'transparent'}">
    ${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`;
  const file = join(tmp, `${out.replace(/[\\/]/g, '_')}.html`);
  writeFileSync(file, html);
  execFileSync(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${size},${size}`, `--screenshot=${join(process.cwd(), out)}`, pathToFileURL(file).href,
  ], { stdio: 'ignore' });
}

render(192, 'rounded', 'public/pwa-192.png');
render(512, 'rounded', 'public/pwa-512.png');
render(512, 'bleed', 'public/pwa-maskable-512.png');
render(180, 'bleed', 'public/apple-touch-icon.png');
render(256, 'rounded', 'scripts/app-256.png');

// Windows ikona pro zástupce (ICO s vloženým PNG 256×256)
const png = readFileSync('scripts/app-256.png');
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head[6] = 0; head[7] = 0; head[8] = 0; head[9] = 0;
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
writeFileSync('scripts/app.ico', Buffer.concat([head, png]));
writeFileSync('public/favicon.svg', svg);

console.log('Ikony vygenerovány z public/logo.svg');
