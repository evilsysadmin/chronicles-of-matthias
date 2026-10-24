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
  // Dismiss the first-run board tutorial before measuring the authenticated HUD.
  const firstSteps = page.locator('[data-chronicles-first-steps]');
  if (await firstSteps.isVisible().catch(() => false)) {
    await firstSteps.getByRole('button', { name: 'Entendido' }).click();
    await firstSteps.waitFor({ state: 'hidden' });
  }
  // Real authenticated HUD: no duplicated objective plaque; Crónica owns
  // the quest text and opens as an accessible dialog. Preserve four hero
  // shortcuts and the right-side sapphire across portrait/landscape phones.
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [768, 354], [844, 390], [1024, 600]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const root = document.querySelector('[data-chronicles="true"]');
      const journal = root?.querySelector('[data-chronicles-journal-trigger]');
      const group = root?.querySelector('[data-chronicles-quick-status-trigger]');
      const faces = [...(root?.querySelectorAll('.chronicles-party-member') || [])];
      if (!root || root.hasAttribute('data-chronicles-hud-fixture') || !journal || !group || faces.length !== 4) return null;
      const rect = (node) => {
        const { left, right, top, bottom, height } = node.getBoundingClientRect();
        return { left, right, top, bottom, height };
      };
      const buttons = [journal, group].map(rect);
      const portraits = faces.map(rect);
      return {
        noPermanentObjective: !root.querySelector('[data-chronicles-objective], .chronicles-objective-trigger'),
        journalVisible: buttons[0].height >= 44,
        groupVisible: buttons[1].height >= 44,
        navBottom: Math.max(...buttons.map(({ bottom }) => bottom)),
        navRight: Math.max(...buttons.map(({ right }) => right)),
        partyTop: Math.min(...portraits.map(({ top }) => top)),
        partyLeft: Math.min(...portraits.map(({ left }) => left)),
        partyRight: Math.max(...portraits.map(({ right }) => right)),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(Boolean(layout) && layout.noPermanentObjective,
      `real game HUD must omit duplicate objective at ${width}x${height}: ${JSON.stringify(layout)}`);
    expect(layout.journalVisible && layout.groupVisible, 'Crónica and Grupo remain touch targets');
    expect(layout.navBottom + 4 <= layout.partyTop,
      `journal/group controls overlap portraits at ${width}x${height}: ${JSON.stringify(layout)}`);
    expect(layout.navRight <= width - 60,
      `journal/group controls obstruct the top-right menu at ${width}x${height}`);
    expect(layout.partyLeft >= -1 && layout.partyRight <= width + 1, 'four portraits fit viewport');
    expect(layout.documentWidth <= width + 1, 'real HUD must not scroll sideways');
    await page.screenshot({ path: `api-e2e-compact-hud-${width}.png` });
    console.log(`REAL_COMPACT_HUD_OK ${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-chronicles-journal-trigger]').click();
  await page.getByRole('dialog', { name: 'Crónica de expedición' }).waitFor({ timeout: 15000 });
  await page.locator('#chronicles-journal-panel-quests').waitFor();
  await page.getByRole('button', { name: 'Cerrar Crónica' }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  // The exploration scene must keep its original generous portrait sizing.
  // The 48px compact selector belongs ONLY to the equipment dossier.
  const explorationPortraits = await page.locator(
    '[data-chronicles="true"] .chronicles-party .chronicles-party-member > .chronicles-party-glyph'
  ).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(explorationPortraits.length === 4
    && explorationPortraits.every((height) => height >= 84 && height <= 170),
  'real exploration HUD portraits must retain their original MM3 proportions: '
    + JSON.stringify(explorationPortraits));
  await page.getByLabel('Abrir menú de Chronicles').click();
  const adventure = page.locator('[data-chronicles-adventure-menu]');
  await adventure.waitFor({ state: 'visible' });
  // Run the same computed-ink contract as the public-staging browser while
  // still inside required API/Mongo E2E, not just the isolated folio fixture.
  await page.screenshot({ path: 'api-e2e-adventure.png' });
  await assertAdventureFolioInk(adventure, 'real-game-1280x800');
  // Prove that the independent Chronicles API actually persists player
  // feedback in Mongo with this authenticated account, not Chess Studio.
  const feedback = await page.evaluate(async (origin) => {
    const token = localStorage.getItem('chess-study-auth-token');
    if (!token) return { error: 'authenticated token missing' };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const sent = await fetch(`${origin}/api/feedback`, {
      method: 'POST', headers,
      body: JSON.stringify({ category: 'idea', message: 'Mejorar la iluminación de la taberna', context: 'Chronicles · menú de aventura' }),
    });
    const body = await sent.json();
    const mine = await fetch(`${origin}/api/feedback/mine`, { headers });
    const myBody = await mine.json();
    return { sentStatus: sent.status, id: body?.feedback?.id,
      mineStatus: mine.status, messages: myBody?.feedback };
  }, apiOrigin);
  expect(feedback.sentStatus === 201 && Boolean(feedback.id),
    'authenticated feedback submission must persist in Chronicles');
  expect(feedback.mineStatus === 200 && Array.isArray(feedback.messages)
    && feedback.messages.some((entry) => entry.id === feedback.id && entry.category === 'idea'),
    'feedback must be readable by its owner from the Chronicles API');

  // Real user-facing mailbox: send through the menu and then read the
  // server's persisted message. ESC must return to the menu, not exit play.
  await adventure.getByRole('button', { name: /Buzón de feedback/ }).click();
  const mailbox = adventure.locator('[data-chronicles-feedback-mailbox]');
  await mailbox.waitFor({ state: 'visible' });
  await mailbox.getByLabel('Tu mensaje').fill('Un monstruo aparece detrás de un muro invisible.');
  await mailbox.getByRole('button', { name: 'Enviar mensaje' }).click();
  await mailbox.getByRole('status').getByText('Mensaje enviado.', { exact: false }).waitFor();
  await mailbox.getByRole('button', { name: 'Consultar mis mensajes' }).click();
  await mailbox.getByText('Un monstruo aparece detrás de un muro invisible.').waitFor();
  await mailbox.getByLabel('Tu mensaje').focus();
  await page.keyboard.press('Escape');
  await adventure.getByRole('button', { name: 'Guardar partida · S' }).waitFor();
  expect(await adventure.isVisible(), 'returning from feedback should keep adventure menu open');

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
    'POST /api/feedback 201',
    'GET /api/feedback/mine 200',
    'PUT /api/chronicles/runs/:id/checkpoint 200',
    'POST /api/auth/login 200',
    'GET /api/chronicles/runs/:id/bootstrap 200',
  ]) expect(calls.includes(want), `missing ${want}`);
  expect(errors.length === 0, 'uncaught page errors');
  console.log('API E2E OK\n' + [...new Set(calls)].join('\n'));
} finally {
  await browser.close();
}
