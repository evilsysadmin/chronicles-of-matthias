// Smoke de montaje: abre Chronicles (/) y Tactics (/#tactics) con una sesión simulada y
// falla si el juego lanza una excepción no capturada o deja la raíz vacía.
// Las llamadas a la API devolverán 401 (token falso): eso es esperado.
// Uso: node smoke/mount.mjs [baseUrl]   (por defecto http://localhost:4173/)
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;

for (const [label, hash] of [['Chronicles', ''], ['Tactics', '#tactics']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('chess-study-auth-token', 'smoke.invalid.token');
    localStorage.setItem('chess-study-auth-username', 'smoke');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Con sesión, la raíz entra directa al juego (sin vestíbulo).
  await page.goto(base + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  const rootLength = (await page.innerHTML('#root')).length;
  const slug = label.toLowerCase();
  await page.screenshot({ path: `smoke-${slug}.png` });
  const ok = errors.length === 0 && rootLength > 500;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: root=${rootLength} errors=${JSON.stringify(errors)}`);
  if (!ok) failed = true;
  await ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
