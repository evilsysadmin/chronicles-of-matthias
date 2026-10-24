// First-party Chromium readiness probe for GitHub's ubuntu-24.04 runner.
// Only a genuine missing-host-library diagnosis authorizes an apt fallback.
// An unrelated browser crash must remain a failed check, not be masked.
import { chromium } from 'playwright';

try {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    timeout: 20000,
  });
  await browser.close();
  console.log('Chromium launch OK: browser cache + host libraries usable.');
} catch (error) {
  const message = String(error?.message || error);
  const missingHostDeps = /Host system is missing dependencies|Missing libraries:|error while loading shared libraries|\.so(?:\.\d+)*: cannot open shared object file/i.test(message);
  console.error('Chromium readiness check failed:', message);
  process.exitCode = missingHostDeps ? 42 : 1;
}
