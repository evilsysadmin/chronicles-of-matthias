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
  // The real authenticated first-person HUD, not a duplicated CSS fixture.
  // Stress the existing rendered objective with long authored-style text only;
  // do not mutate React state, combat, saves, quests or server records.
  const hudOriginal = await page.evaluate(() => {
    const root = document.querySelector('[data-chronicles="true"]');
    const button = root?.querySelector('[data-chronicles-objective]');
    const label = button?.querySelector('b');
    const route = button?.querySelector('.chronicles-route-hint');
    const portraits = root?.querySelectorAll('.chronicles-party-member');
    if (!root || !button || !label || portraits?.length !== 4
      || root.hasAttribute('data-chronicles-hud-fixture')) return null;
    return { objective: label.textContent, route: route?.textContent || null, title: button.title };
  });
  expect(Boolean(hudOriginal), 'actual MM3 objective and four real portraits must mount');
  // The first-run guide can cover the top of the scene. Close it before
  // collecting visual evidence; it is not part of the objective HUD.
  const firstSteps = page.locator('[data-chronicles-first-steps]');
  if (await firstSteps.isVisible().catch(() => false)) {
    await firstSteps.getByRole('button', { name: 'Entendido' }).click();
    await firstSteps.waitFor({ state: 'hidden' });
  }
  for (const [width, height] of [[360, 780], [390, 844], [430, 932], [768, 354], [844, 390], [1024, 600]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const button = document.querySelector('[data-chronicles="true"] [data-chronicles-objective]');
      const label = button.querySelector('b');
      const route = button.querySelector('.chronicles-route-hint');
      const objective = 'Busca el estandarte cerca del mojón sin nombre, antes de cruzar el desfiladero de las ruinas antiguas.';
      const destination = 'DESTINO · Camino de los Estandartes · Salir al Camino de los Estandartes · por el norte, después por la bifurcación oeste';
      label.textContent = objective;
      if (route) route.textContent = destination;
      button.title = `Objetivo: ${objective}\n${destination}\nAbrir la Crónica (J)`;
      const rect = (node) => {
        const { left, right, top, bottom } = node.getBoundingClientRect();
        return { left, right, top, bottom };
      };
      const faces = [...document.querySelectorAll('[data-chronicles="true"] .chronicles-party-member')];
      const partyRects = faces.map(rect);
      const objectiveRect = rect(button.closest('.chronicles-statusbar > span'));
      return {
        objectiveRect,
        partyTop: Math.min(...partyRects.map(({ top }) => top)),
        partyLeft: Math.min(...partyRects.map(({ left }) => left)),
        partyRight: Math.max(...partyRects.map(({ right }) => right)),
        faces: partyRects.length,
        labelOverflow: getComputedStyle(label).textOverflow,
        labelWrap: getComputedStyle(label).whiteSpace,
        routeOverflow: route ? getComputedStyle(route).textOverflow : null,
        routeWrap: route ? getComputedStyle(route).whiteSpace : null,
        title: button.title,
        objective, destination,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.faces === 4 && layout.partyTop >= layout.objectiveRect.bottom + 4,
      `real HUD objective overlaps portraits at ${width}x${height}: ${JSON.stringify(layout)}`);
    expect(layout.partyLeft >= -1 && layout.partyRight <= width + 1,
      `real HUD portraits leave viewport at ${width}x${height}: ${JSON.stringify(layout)}`);
    expect(layout.labelOverflow === 'ellipsis' && layout.labelWrap === 'nowrap',
      `real HUD long objective does not truncate at ${width}x${height}`);
    if (layout.routeOverflow !== null) {
      expect(layout.routeOverflow === 'ellipsis' && layout.routeWrap === 'nowrap',
        `real HUD long destination does not truncate at ${width}x${height}`);
    }
    expect(layout.title.includes(layout.objective) && layout.title.includes(layout.destination),
      'full objective and destination must remain available via the real button tooltip');
    expect(layout.documentWidth <= width + 1,
      `real HUD creates horizontal scroll at ${width}x${height}`);
    await page.screenshot({ path: `api-e2e-objective-hud-${width}.png` });
    console.log(`REAL_OBJECTIVE_HUD_OK ${width}x${height}`);
  }
  await page.evaluate(({ objective, route, title }) => {
    const button = document.querySelector('[data-chronicles="true"] [data-chronicles-objective]');
    button.querySelector('b').textContent = objective;
    const routeNode = button.querySelector('.chronicles-route-hint');
    if (routeNode && route !== null) routeNode.textContent = route;
    button.title = title;
  }, hudOriginal);
  await page.setViewportSize({ width: 1280, height: 800 });
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
