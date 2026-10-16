// Smoke de montaje: entra en Chronicles y en Tactics con una sesión simulada y
// falla si el juego lanza una excepción no capturada o deja la raíz vacía.
// Las llamadas a la API devolverán 401 (token falso): eso es esperado.
// Uso: node smoke/mount.mjs [baseUrl]   (por defecto http://localhost:4173/)
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;

for (const button of ['Jugar Chronicles', 'Chronicles Tactics']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('chess-study-auth-token', 'smoke.invalid.token');
    localStorage.setItem('chess-study-auth-username', 'smoke');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: button }).click();
  await page.waitForTimeout(6000);
  const rootLength = (await page.innerHTML('#root')).length;
  const slug = button.toLowerCase().replace(/\s+/g, '-');
  await page.screenshot({ path: `smoke-${slug}.png` });
  const ok = errors.length === 0 && rootLength > 500;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${button}: root=${rootLength} errors=${JSON.stringify(errors)}`);
  if (!ok) failed = true;
  await ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
