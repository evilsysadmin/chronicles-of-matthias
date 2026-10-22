// Smoke de montaje: abre Chronicles (/) y Tactics (/#tactics) con una sesión simulada y
// falla si el juego lanza una excepción no capturada o deja la raíz vacía.
// Las llamadas a la API devolverán 401 (token falso): eso es esperado.
// Uso: node smoke/mount.mjs [baseUrl]   (por defecto http://localhost:4173/)
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;

// Freeze the *entrypoint* JavaScript, not the DOM, to exercise the HTML shell
// users see with a cold cache or slow network. No simulated login and no
// test-only runtime route: this loads the real built index.html and artwork.
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route('**/assets/*.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript', body: '',
  }));
  const page = await ctx.newPage();
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const shell = page.locator('#root > .chronicles-boot');
    await shell.waitFor({ state: 'visible', timeout: 10_000 });
    const geometry = await page.evaluate(() => {
      const shell = document.querySelector('#root > .chronicles-boot');
      const title = shell?.querySelector('.chronicles-boot__title');
      const crest = shell?.querySelector('.chronicles-boot__crest');
      const track = shell?.querySelector('.chronicles-boot__track');
      const artwork = shell?.querySelector('.chronicles-boot__art');
      const rect = (element) => {
        const bounds = element?.getBoundingClientRect();
        return bounds && { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
      };
      return {
        screen: rect(shell), title: rect(title), crest: rect(crest), track: rect(track),
        artworkLoaded: Boolean(artwork?.complete && artwork.naturalWidth),
        crestLoaded: Boolean(crest?.complete && crest.naturalWidth),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        status: shell?.getAttribute('role'),
      };
    });
    const fits = (rect) => rect && rect.width > 0 && rect.height > 0
      && rect.left >= -1 && rect.top >= -1
      && rect.left + rect.width <= viewport.width + 1
      && rect.top + rect.height <= viewport.height + 1;
    if (geometry.status !== 'status' || !geometry.artworkLoaded || !geometry.crestLoaded ||
      geometry.horizontalOverflow || !fits(geometry.title) || !fits(geometry.crest) ||
      !fits(geometry.track) || geometry.screen?.width < viewport.width - 1 ||
      geometry.screen?.height < viewport.height - 1) {
      throw new Error('First-paint loader fails viewport contract: ' + JSON.stringify(geometry));
    }
    await page.screenshot({ path: 'smoke-loader-' + viewport.width + '.png' });
    console.log('OK   First-paint loading: ' + viewport.width + 'x' + viewport.height);
  } catch (error) {
    failed = true;
    console.log('FAIL First-paint loading:', viewport.width, error.message);
  } finally {
    await ctx.close();
  }
}

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
  // Where the authenticated MM3 HUD is present, the objective is a
  // one-line navigational hint, not a tall message hiding the stage.
  // The full quest text must stay accessible via title/Crónica.
  if (label === 'Chronicles') {
    const objective = await page.evaluate(() => {
      const button = document.querySelector('[data-chronicles-objective]');
      if (!button || !button.getClientRects().length) return null;
      const content = button.querySelector('b');
      return {
        panelHeight: button.parentElement.getBoundingClientRect().height,
        textOverflow: getComputedStyle(content).textOverflow,
        whiteSpace: getComputedStyle(content).whiteSpace,
        fullText: content.textContent.trim(),
        title: button.title,
      };
    });
    if (objective && (objective.panelHeight > 48 || objective.textOverflow !== 'ellipsis'
      || objective.whiteSpace !== 'nowrap' || !objective.title.includes(objective.fullText))) {
      throw new Error('Desktop objective must be compact, readable via Crónica: ' + JSON.stringify(objective));
    }
  }
  const slug = label.toLowerCase();
  await page.screenshot({ path: `smoke-${slug}.png` });
  const ok = errors.length === 0 && rootLength > 500;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: root=${rootLength} errors=${JSON.stringify(errors)}`);
  if (!ok) failed = true;
  await ctx.close();
}


// An unauthenticated client must see an accessible, explicit update action.
// The real Pages manifest is emitted from VITE_BUILD_SHA; this browser route
// substitutes a newer SHA so the notice is tested without deploying a release.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/release.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ release: 'v16.6dm46zfrv', build: 'b'.repeat(40) }),
  }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const banner = page.getByRole('status').filter({ hasText: 'Nueva versión disponible' });
  try {
    await banner.waitFor({ timeout: 12_000 });
    const update = await banner.getByRole('button', { name: 'Actualizar' }).count();
    const defer = await banner.getByRole('button', { name: 'Ahora no' }).count();
    if (update !== 1 || defer !== 1 || errors.length) throw new Error('missing actions or page errors');
    console.log('OK   Releases: explicit refresh offered on login');
  } catch (error) {
    failed = true;
    console.log('FAIL Releases:', error.message, errors);
  }
  await ctx.close();
}

// The real transition presentation must not look like a full-screen
// interrupting cinematic. Test its authored CSS at desktop, portrait phone
// and narrow landscape sizes (the real game checks reducer and focus logic).
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  try {
    await page.setContent(`
      <div class="chronicles-area-transition" data-chronicles-area-transition>
        <section class="chronicles-area-transition__card" role="dialog" aria-modal="true">
          <div class="chronicles-area-transition__eyebrow">UN NUEVO UMBRAL</div>
          <h2>¿Quieres salir de Swordhaven hacia Camino de los Estandartes?</h2>
          <p>La compañía espera tu decisión.</p>
          <div class="chronicles-area-transition__actions">
            <button data-area-transition-cancel>No · Esc</button>
            <button class="is-primary" data-area-transition-accept>Sí · Enter</button>
          </div>
        </section>
      </div>
    `);
    await page.addStyleTag({ path: 'src/components/ChroniclesAreaTransition.css' });
    const geometry = await page.evaluate(() => {
      const overlay = document.querySelector('[data-chronicles-area-transition]');
      const card = overlay.querySelector('[role="dialog"]');
      const buttons = [...card.querySelectorAll('button')];
      const rect = (element) => {
        const { left, top, bottom, right, width, height } = element.getBoundingClientRect();
        return { left, top, bottom, right, width, height };
      };
      return {
        card: rect(card),
        buttons: buttons.map(rect),
        blur: getComputedStyle(overlay).backdropFilter,
        scrim: getComputedStyle(overlay).backgroundColor,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    const scrimOpacity = geometry.scrim.startsWith('rgba(')
      ? Number(geometry.scrim.split(',').at(-1).replace(')', '').trim()) : 1;
    const clearView = geometry.blur === 'none' && scrimOpacity <= .25;
    const compact = geometry.card.width <= 480 && geometry.card.height <= 240
      && geometry.card.left >= 0 && geometry.card.right <= viewport.width
      && geometry.card.top >= 0 && geometry.card.bottom <= viewport.height
      && geometry.scrollWidth <= viewport.width
      && geometry.buttons.every((button) => button.height >= 44 && button.width >= 80);
    if (!clearView || !compact ||
      (viewport.width >= 1025 && geometry.card.bottom >= viewport.height - 65)) {
      throw new Error('Travel confirmation obscures viewport: ' + JSON.stringify(geometry));
    }
    await page.locator('[data-area-transition-cancel]').focus();
    await page.keyboard.press('Tab');
    if (!(await page.locator('[data-area-transition-accept]').evaluate((button) => button === document.activeElement))) {
      throw new Error('Travel confirmation buttons are not keyboard reachable');
    }
    await page.screenshot({ path: 'smoke-travel-confirm-' + viewport.width + '.png' });
    console.log('OK   Compact travel choice: ' + viewport.width + 'x' + viewport.height);
  } catch (error) {
    failed = true;
    console.log('FAIL Compact travel choice:', viewport.width, error.message);
  } finally {
    await ctx.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
