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
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        status: shell?.getAttribute('role'),
      };
    });
    const fits = (rect) => rect && rect.width > 0 && rect.height > 0
      && rect.left >= -1 && rect.top >= -1
      && rect.left + rect.width <= viewport.width + 1
      && rect.top + rect.height <= viewport.height + 1;
    if (geometry.status !== 'status' || !geometry.artworkLoaded ||
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

await browser.close();
process.exit(failed ? 1 : 0);
