// E2E del juego contra la API propia de Chronicles (con Mongo real):
// registro con invitación → libro sin error de servidor → nueva campaña con el
// grupo canónico (crea run) → guardar desde el menú (checkpoint) → navegador
// limpio: login → «Continuar partida» reanuda desde el servidor (bootstrap).
// Uso: node smoke/api-e2e.mjs <frontendUrl> <apiOrigin> <inviteCode>
import { chromium } from 'playwright';
import { assertAdventureFolioInk } from './adventure-contrast.mjs';

const [base = 'http://localhost:5173/', apiOrigin = 'http://127.0.0.1:8090', invite = 'TESTINV'] = process.argv.slice(2);
const user = `cronista_${Date.now().toString(36)}`;
const password = 'Matthias-2026!';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const calls = [];
const errors = [];

function watch(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().startsWith(apiOrigin)) calls.push(`${r.request().method()} ${new URL(r.url()).pathname.replace(/[0-9a-f-]{36}/, ':id')} ${r.status()}`);
  });
}
const body = async (page) => (await page.innerText('body')).replace(/\s+/g, ' ');
function expect(cond, message) {
  if (!cond) throw new Error(`E2E: ${message}\ncalls:\n${calls.join('\n')}\nerrors: ${JSON.stringify(errors)}`);
}

try {
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await ctx.newPage();
  watch(page);
  await page.goto(`${base}?invite=${encodeURIComponent(invite)}`, { waitUntil: 'networkidle' });
  const fields = await page.$$('input');
  await fields[0].fill(user);
  await fields[1].fill(`${user}@example.com`);
  await fields[2].fill(password);
  if (!(await fields[3].inputValue())) await fields[3].fill(invite);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('button', { name: /Nueva expedición/ }).waitFor({ timeout: 20000 });
  expect(!(await body(page)).includes('No se pudo consultar el servidor'), 'book could not reach the API');

  await page.getByRole('button', { name: /Nueva expedición/ }).click();
  await page.getByRole('button', { name: 'Empezar con este grupo' }).click();
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.getByLabel('Abrir menú de Chronicles').click();
  const adventure = page.locator('[data-chronicles-adventure-menu]');
  await adventure.waitFor({ state: 'visible' });
  // Run the same computed-ink contract as the public-staging browser while
  // still inside required API/Mongo E2E, not just the isolated folio fixture.
  await page.screenshot({ path: 'api-e2e-adventure.png' });
  await assertAdventureFolioInk(adventure, 'real-game-1280x800');
  await page.getByRole('button', { name: 'Guardar partida' }).click();
  await page.getByText('Partida guardada correctamente.').waitFor({ timeout: 15000 });
  await page.screenshot({ path: 'api-e2e-saved.png' });
  await ctx.close();

  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await ctx.newPage();
  watch(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  const login = await page.$$('input');
  await login[0].fill(user);
  await login[1].fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: /Continuar expedición/ }).click({ timeout: 20000 });
  await page.getByLabel('Abrir menú de Chronicles').waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'api-e2e-resumed.png' });
  await ctx.close();

  for (const want of [
    'POST /api/auth/register 201',
    'POST /api/chronicles/runs 201',
    'PUT /api/chronicles/runs/:id/checkpoint 200',
    'POST /api/auth/login 200',
    'GET /api/chronicles/runs/:id/bootstrap 200',
  ]) expect(calls.includes(want), `missing ${want}`);
  expect(errors.length === 0, 'uncaught page errors');
  console.log('API E2E OK\n' + [...new Set(calls)].join('\n'));
} finally {
  await browser.close();
}
