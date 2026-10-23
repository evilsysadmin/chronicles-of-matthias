// Real React journal smoke: no backend credentials or debug routes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:4174/smoke/journal-book.html';
const sizes = [[390, 844], [844, 390], [1280, 800]];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: width <= 844,
      hasTouch: width <= 844, deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      const dialog = page.getByRole('dialog', { name: /Crónica de expedición/ });
      await dialog.waitFor({ state: 'visible' });
      // A narrow readable travel book, not a 940px administrative panel.
      // Mobile/short landscape retain enough room and their existing scroll.
      const folioFrame = await dialog.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const header = node.querySelector('.chronicles-journal-modal__header').getBoundingClientRect();
        const tabs = node.querySelector('.chronicles-journal-modal__chapters button');
        const chapter = node.querySelector('.chronicles-journal-modal__chapter');
        return { width: box.width, height: box.height, headerHeight: header.height,
          tabBackground: getComputedStyle(tabs).backgroundColor,
          chapterWidth: chapter?.getBoundingClientRect().width };
      });
      if (width >= 1025) {
        assert(folioFrame.width <= 705, 'Fieldbook should not span like a dashboard');
        assert(folioFrame.height <= Math.min(height * .81, 701), 'Fieldbook should not monopolize the desktop');
        assert(folioFrame.headerHeight <= 80, 'Journal masthead should stay restrained');
        assert(folioFrame.chapterWidth <= 625, 'Journal prose should keep a readable measure');
      }
      assert.equal(folioFrame.tabBackground, 'rgba(0, 0, 0, 0)',
        'Chapter bookmarks should not look like filled dashboard cards');
      const tabQuests = dialog.getByRole('tab', { name: /Encargos/ });
      const tabMemories = dialog.getByRole('tab', { name: /Memorias/ });
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'false');
      await dialog.getByRole('heading', { name: 'Los asuntos pendientes' }).waitFor();
      assert.match(await tabQuests.getAttribute('aria-label'), /Encargos · 2 pendientes/);
      assert.equal(await tabQuests.innerText(), 'Encargos', 'No visible KPI badges in chapter tabs');
      assert.equal(await dialog.getByRole('tabpanel').count(), 1,
        'Journal should show one chapter at a time, not a two-panel dashboard');
      // The book announces tab semantics, so readers should also get standard
      // roving focus with arrows and Home/End, with a single normal Tab stop.
      await tabQuests.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'true');
      assert.equal(await tabMemories.evaluate((element) => document.activeElement === element), true);
      assert.equal(await tabQuests.getAttribute('tabindex'), '-1');
      await page.keyboard.press('ArrowRight');
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await tabQuests.evaluate((element) => document.activeElement === element), true);
      await page.keyboard.press('End');
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Home');
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await dialog.getByRole('tabpanel').count(), 1);
      const first = dialog.locator('[data-chronicles-quest-id="banner-contract"]');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      const firstHeading = first.locator('.chronicles-journal-modal__quest-heading');
      assert.equal(await firstHeading.getAttribute('aria-controls') !== null, true,
        'Only open quest heading can announce the mounted detail panel');
      assert.match(await first.innerText(), /Camino de los Estandartes/);
      assert.match(await first.innerText(), /mojón sin nombre/);
      await first.locator('[data-chronicles-quest-event="first-book-contract-accepted"]').waitFor();
      // Make the underlying world scrollable in this CI-only fixture, then
      // ensure book navigation never moves the document behind the portal.
      // Constrain only the journal leaf to exercise real internal scrolling.
      const worldScroll = await page.evaluate(() => {
        document.documentElement.style.minHeight = '3000px';
        document.body.style.minHeight = '3000px';
        const leaf = document.querySelector('.chronicles-journal-modal__scroll');
        leaf.style.maxHeight = '180px';
        window.scrollTo(0, 300);
        return window.scrollY;
      });
      // An actual recorded quest milestone is a direct link to its original
      // folio. Preserve the selected quest when navigating back to Encargos.
      await first.locator('[data-chronicles-quest-event="first-book-contract-accepted"] .chronicles-journal-modal__quest-event-link').click();
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'true');
      const sourceFolio = dialog.locator('[data-chronicles-memo-id="first-book-contract-accepted"]');
      await sourceFolio.waitFor({ state: 'visible' });
      assert.match(await sourceFolio.innerText(), /Encargo del alguacil/);
      assert.equal(await sourceFolio.evaluate((element) => document.activeElement === element), true,
        'Jumped-to original folio should receive keyboard/screen-reader focus');
      assert.equal(await page.evaluate(() => window.scrollY), worldScroll,
        'Jumping to saved memories must not move the world behind the book');
      assert.equal(await sourceFolio.getAttribute('class'), 'is-jump-target');
      const returnToQuest = dialog.locator('[data-chronicles-return-to-quest="banner-contract"]');
      await returnToQuest.click();
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading')
        .evaluate((element) => document.activeElement === element), true,
        'Return bookmark must focus the actual quest heading');
      assert.equal(await page.evaluate(() => window.scrollY), worldScroll,
        'Returning to the quest must not scroll the underlying world');
      await page.evaluate(() => {
        document.querySelector('.chronicles-journal-modal__scroll').style.maxHeight = '';
        document.documentElement.style.minHeight = '';
        document.body.style.minHeight = '';
      });
      assert.equal(await sourceFolio.count(), 0, 'Hidden chapter should not retain focusable folio');

      assert.equal(await first.locator('[data-chronicles-quest-event="first-book-banner-found"]').count(), 0,
        'Unreached quest milestones must never be invented');
      assert.equal(await first.locator('[data-chronicles-quest-relation="another-region"]').count(), 1,
        'The party starts in Swordhaven; the banner clue points to the road');
      const second = dialog.locator('[data-chronicles-quest-id="names-in-wood"]');
      assert.match(await second.innerText(), /Rookwood/);
      await second.locator('.chronicles-journal-modal__quest-heading').click();
      assert.equal(await second.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'false');
      assert.equal(await firstHeading.getAttribute('aria-controls'), null,
        'A closed quest must never reference an absent detail panel');
      assert.match(await second.innerText(), /Roble del Claro/);
      assert.equal(await second.locator('[data-chronicles-quest-event]').count(), 0,
        'Quest without journal receipts must not fabricate a history');
      assert.equal(await second.locator('.chronicles-journal-modal__quest-event-link').count(), 0,
        'Unknown history must not offer a link to a non-existent memory');
      assert.match(await second.locator('[data-chronicles-quest-relation="another-region"]').innerText(),
        /Desde Swordhaven, tus notas apuntan a Rookwood/);
      // Reuse the true reducer's existing trackedQuestId contract. HUD and
      // quest overlay must see the same selected goal, including null reset.
      const followed = page.locator('[data-test-tracked-quest]');
      const followSecond = second.locator('[data-chronicles-track-quest="names-in-wood"]');
      await followSecond.click();
      assert.equal(await followed.textContent(), 'names-in-wood');
      assert.equal(await followSecond.getAttribute('aria-pressed'), 'true');
      assert.equal(await second.locator('[data-chronicles-followed-quest="names-in-wood"]').count(), 1,
        'Followed quest must be identifiable without opening its checkout details');
      assert.equal(await dialog.locator('[data-chronicles-followed-quest]').count(), 1,
        'Only one quest can carry the current followed bookmark');
      await first.locator('.chronicles-journal-modal__quest-heading').click();
      const followFirst = first.locator('[data-chronicles-track-quest="banner-contract"]');
      await followFirst.click();
      assert.equal(await followed.textContent(), 'banner-contract');
      assert.equal(await followFirst.getAttribute('aria-pressed'), 'true');
      assert.equal(await first.locator('[data-chronicles-followed-quest="banner-contract"]').count(), 1);
      assert.equal(await second.locator('[data-chronicles-followed-quest]').count(), 0,
        'Changing followed quest must remove the former mark');
      await followFirst.click();
      assert.equal(await followed.textContent(), 'automatico');
      assert.equal(await followFirst.getAttribute('aria-pressed'), 'false');
      assert.equal(await dialog.locator('[data-chronicles-followed-quest]').count(), 0,
        'Automatic tracking must not leave a stale followed mark');
      await second.locator('.chronicles-journal-modal__quest-heading').click();
      const completed = dialog.locator('[data-chronicles-quest-id="road-bandits"]');
      assert.equal(await completed.count(), 0, 'Archived quests should not clutter an active expedition');
      assert.equal(await dialog.locator('.chronicles-journal-modal__archive-heading').count(), 0,
        'A collapsed archive must not show a redundant heading');
      const archive = dialog.locator('.chronicles-journal-modal__archive-toggle');
      assert.equal(await archive.getAttribute('aria-expanded'), 'false');
      assert.match(await archive.innerText(), /Ver encargos resueltos \(1\)/);
      // Simulate a long diary: the archived appendix is beneath the visible
      // leaf. Activating the control must reveal the new section IN the book
      // without scrolling the world or leaving keyboard focus off-screen.
      const beforeArchiveWorldY = await page.evaluate(() => {
        const leaf = document.querySelector('.chronicles-journal-modal__scroll');
        leaf.style.maxHeight = '150px';
        leaf.scrollTop = 0;
        return window.scrollY;
      });
      await archive.click();
      assert.equal(await archive.getAttribute('aria-expanded'), 'true');
      const archiveJump = await dialog.locator('.chronicles-journal-modal__archive-heading h4').evaluate((target) => {
        const leaf = document.querySelector('.chronicles-journal-modal__scroll');
        const viewport = leaf.getBoundingClientRect();
        const heading = target.getBoundingClientRect();
        return {
          focused: document.activeElement === target,
          top: heading.top,
          bottom: heading.bottom,
          viewportTop: viewport.top,
          viewportBottom: viewport.bottom,
          bookScroll: leaf.scrollTop,
          worldScroll: window.scrollY,
        };
      });
      assert(archiveJump.focused, 'Expanded archive heading must receive keyboard focus');
      assert(archiveJump.bookScroll > 0, 'The book should reveal an appendix beneath active quests');
      assert(archiveJump.top >= archiveJump.viewportTop - 1
        && archiveJump.bottom <= archiveJump.viewportBottom + 1,
      'The archive heading must be visible inside the book: ' + JSON.stringify(archiveJump));
      assert.equal(archiveJump.worldScroll, beforeArchiveWorldY,
        'Opening the archive must not move the world behind the journal');
      await page.evaluate(() => { document.querySelector('.chronicles-journal-modal__scroll').style.maxHeight = ''; });
      const questRows = await dialog.locator('[data-chronicles-quest-id]').evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute('data-chronicles-quest-id')));
      assert.deepEqual(questRows, ['banner-contract', 'names-in-wood', 'road-bandits'],
        'All active pages must precede the archived appendix, irrespective of original quest order');
      const heading = dialog.locator('.chronicles-journal-modal__archive-heading');
      assert.equal(await heading.count(), 1);
      assert.match(await heading.innerText(), /Gestas concluidas/);
      assert.equal(await heading.evaluate((element) => Boolean(
        element.compareDocumentPosition(document.querySelector('[data-chronicles-quest-id="road-bandits"]'))
          & Node.DOCUMENT_POSITION_FOLLOWING)), true,
        'The appendix title must precede its first archived contract');

      assert.match(await completed.innerText(), /Resuelto/);
      assert.doesNotMatch(await completed.innerText(), /PISTA DEL LUGAR/);
      await completed.locator('.chronicles-journal-modal__quest-heading').click();
      assert.equal(await completed.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-controls') !== null, true,
        'Archived open quest must reference its visible history');
      await completed.locator('[data-chronicles-quest-event="banner-road-captain-falls"]').waitFor();
      assert.match(await completed.innerText(), /Cae Garrah/);
      await second.locator('.chronicles-journal-modal__quest-heading').click();
      assert.equal(await completed.locator('[data-chronicles-track-quest]').count(), 0,
        'A completed contract cannot be followed');
      await archive.click();
      assert.equal(await archive.getAttribute('aria-expanded'), 'false');
      assert.equal(await completed.count(), 0, 'Folded archive must remove completed rows again');
      assert.equal(await heading.count(), 0, 'Folding the archive hides its appendix heading');
      assert.equal(await second.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true',
        'Folding the archive should restore the current active quest');
      await page.screenshot({ path: 'smoke-journal-quests-' + width + '.png' });
      const size = await page.evaluate(() => {
        const rect = document.querySelector('.chronicles-journal-modal').getBoundingClientRect();
        return { documentWidth: document.documentElement.scrollWidth,
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          overflow: document.body.style.overflow };
      });
      assert(size.documentWidth <= width + 1, 'Journal overflows viewport width');
      assert(size.left >= -1 && size.right <= width + 1
        && size.top >= -1 && size.bottom <= height + 1, 'Journal escapes viewport');
      assert.equal(size.overflow, 'hidden', 'Journal should lock world scrolling');
      await tabMemories.click();
      assert.equal(await tabMemories.getAttribute('aria-selected'), 'true');
      await dialog.getByText('Primera jornada').waitFor();
      // A memory can navigate back to a known quest, including an archived
      // contract. A generic folio must not offer invented related quests.
      assert.equal(await dialog.locator('[data-chronicles-memo-id="first-footstep"] [data-chronicles-memory-quest]').count(), 0,
        'Unrelated memory cannot reveal a fictional contract');
      const captainMemory = dialog.locator('[data-chronicles-memo-id="banner-road-captain-falls"]');
      await captainMemory.locator('[data-chronicles-memory-quest="road-bandits"]').click();
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await archive.getAttribute('aria-expanded'), 'true',
        'A related completed contract must be unfolded before navigation');
      const archivedHeading = completed.locator('.chronicles-journal-modal__quest-heading');
      assert.equal(await archivedHeading.getAttribute('aria-expanded'), 'true');
      assert.equal(await archivedHeading.evaluate((el) => document.activeElement === el), true,
        'Memory-to-quest navigation should focus the actual archived heading');
      await tabMemories.click();
      const acceptedMemory = dialog.locator('[data-chronicles-memo-id="first-book-contract-accepted"]');
      await acceptedMemory.locator('[data-chronicles-memory-quest="banner-contract"]').click();
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      await tabMemories.click();
      await dialog.getByText('El viento sopló desde el bosque.').waitFor();
      await page.screenshot({ path: 'smoke-journal-memories-' + width + '.png' });
      await tabQuests.click();
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true',
        'Switching chapters must retain the last quest explicitly chosen from a memory');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), '',
        'Closing journal must restore scrolling');

      // A new visit must open the followed quest instead of the old chapter
      // or the previous manually expanded row.
      await page.locator('[data-test-reopen-followed]').click();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      assert.equal(await second.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true',
        'A fresh journal visit should open the actually followed quest');
      assert.equal(await first.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'false');
      await tabMemories.click();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });

      // The portal remains mounted across runs. Old quest selection must
      // never leave the next expedition with a mysteriously blank folio.
      await page.locator('[data-test-another-expedition]').click();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await tabQuests.getAttribute('aria-selected'), 'true');
      const nextQuest = dialog.locator('[data-chronicles-quest-id="another-adventure"]');
      assert.equal(await nextQuest.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      assert.equal(await first.count(), 0, 'Old expedition quests must not remain visible');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('[data-test-only-completed]').click();
      await dialog.waitFor({ state: 'visible' });
      const oldDeeds = dialog.locator('[data-chronicles-quest-id="road-bandits"]');
      assert.equal(await oldDeeds.count(), 1,
        'When no active quests exist, completed contracts must stay accessible');
      await dialog.getByRole('heading', { name: 'Las gestas concluidas' }).waitFor();
      assert.match(await tabQuests.getAttribute('aria-label'), /1 resuelto/);
      assert.match(await dialog.getByRole('tabpanel').innerText(), /conservan los hechos que vivimos/);
      assert.equal(await oldDeeds.locator('.chronicles-journal-modal__quest-heading').getAttribute('aria-expanded'), 'true');
      assert.equal(await archive.count(), 0, 'An all-completed journal must not hide its entire list');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('[data-test-no-quests]').click();
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('heading', { name: 'Páginas por escribir' }).waitFor();
      assert.match(await tabQuests.getAttribute('aria-label'), /Sin encargos/);
      assert.equal(await dialog.locator('[data-chronicles-quest-id]').count(), 0);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });

      // An active expedition can contain many quest entries. Opening the book
      // must reveal its far-down tracked contract without scrolling the world
      // or stealing focus from the close affordance.
      await page.locator('[data-test-long-journal]').click();
      await dialog.waitFor({ state: 'visible' });
      const followedHeading = dialog.locator('[data-chronicles-quest-id="names-in-wood"] .chronicles-journal-modal__quest-heading');
      assert.equal(await followedHeading.getAttribute('aria-expanded'), 'true');
      const followedGeometry = await followedHeading.evaluate((element) => {
        const scroll = document.querySelector('.chronicles-journal-modal__scroll');
        const viewport = scroll.getBoundingClientRect();
        const row = element.getBoundingClientRect();
        const rows = Array.from(document.querySelectorAll('[data-chronicles-quest-id]'));
        return {
          renderedQuestCount: rows.length,
          followedPosition: rows.findIndex((node) => node.getAttribute('data-chronicles-quest-id') === 'names-in-wood'),
          firstQuestId: rows[0]?.getAttribute('data-chronicles-quest-id'),
          lastQuestId: rows[rows.length - 1]?.getAttribute('data-chronicles-quest-id'),
          scrollTop: scroll.scrollTop,
          scrollHeight: scroll.scrollHeight,
          clientHeight: scroll.clientHeight,
          rowTop: Math.round(row.top),
          rowBottom: Math.round(row.bottom),
          viewportTop: Math.round(viewport.top),
          viewportBottom: Math.round(viewport.bottom),
          headingWithinBook: row.top >= viewport.top - 2 && row.bottom <= viewport.bottom + 2,
          focusedClose: document.activeElement?.getAttribute('aria-label') === 'Cerrar Crónica',
        };
      });
      assert.equal(followedGeometry.renderedQuestCount, 25, 'Exercise a genuinely long journal');
      assert.equal(followedGeometry.followedPosition, followedGeometry.renderedQuestCount - 1,
        'Tracked quest must be last under real catalog ordering: ' + JSON.stringify(followedGeometry));
      assert(followedGeometry.scrollTop > 0, 'Distant tracked quest should scroll the book: ' + JSON.stringify(followedGeometry));
      assert(followedGeometry.headingWithinBook, 'Tracked quest heading should be visible on first opening: ' + JSON.stringify(followedGeometry));
      assert(followedGeometry.focusedClose, 'Opening must preserve keyboard focus on dialog close');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, [], 'Browser errors while reading journal');
      console.log('CHRONICLES_JOURNAL_BOOK_OK ' + width + 'x' + height);
    } catch (error) {
      failures++;
      console.error('CHRONICLES_JOURNAL_BOOK_FAIL ' + width + 'x' + height + ': ' + (error.stack || error));
      await page.screenshot({ path: 'smoke-journal-FAIL-' + width + '.png' }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures) process.exitCode = 1;
