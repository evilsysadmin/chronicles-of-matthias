// Vite-backed Chromium fixture navigations can occasionally be cancelled
// before DOMContentLoaded (ERR_ABORTED) without a functional assertion failing.
// Retry that *one* transient browser-navigation error once, then let all
// existing real-component assertions execute unchanged. Never retry page errors,
// closed pages, timeouts or a second aborted navigation.
export async function gotoSmokeFixture(page, url) {
  const options = { waitUntil: 'domcontentloaded' };
  try {
    return await page.goto(url, options);
  } catch (error) {
    if (!/net::ERR_ABORTED\b/.test(String(error?.message || error)) || page.isClosed?.()) {
      throw error;
    }
    console.warn('CHRONICLES_FIXTURE_NAV_RETRY reason=ERR_ABORTED once=1 url=' + url);
    return page.goto(url, options);
  }
}
