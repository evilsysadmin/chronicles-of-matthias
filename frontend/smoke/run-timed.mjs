// Observe real Chromium smoke durations without skipping, mocking or
// parallelizing any fixture. Failures propagate their original exit status.
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const [script, ...args] = process.argv.slice(2);
if (!script || !script.endsWith('.mjs')) {
  console.error('Usage: node smoke/run-timed.mjs <fixture.mjs> [fixture args...]');
  process.exitCode = 64;
} else {
  const started = performance.now();
  const child = spawn(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('error', (err) => {
    console.error('Could not launch Chromium smoke', script, err);
  });
  child.on('close', (code, signal) => {
    const seconds = ((performance.now() - started) / 1000).toFixed(2);
    const status = code === 0 && !signal ? 'PASS' : 'FAIL';
    const name = script.split('/').at(-1);
    console.log(`CHRONICLES_SMOKE_TIME fixture=${name} seconds=${seconds} status=${status}`);
    if (status === 'FAIL') {
      console.error(`::error title=Chronicles Chromium smoke failed::${name} exited ${code ?? signal}`);
    }
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) {
      try {
        let old = '';
        try { old = readFileSync(summary, 'utf8'); } catch { /* no existing summary */ }
        if (!old.includes('## Chronicles Chromium smoke timings')) {
          appendFileSync(summary, '\n## Chronicles Chromium smoke timings\n\n| Fixture | Seconds | Result |\n| --- | ---: | --- |\n');
        }
        appendFileSync(summary, `| ${name} | ${seconds} | ${status} |\n`);
      } catch (err) {
        // GitHub step summary is informative, never a substitute for E2E status.
        console.warn('Could not write smoke timing summary:', err.message);
      }
    }
    process.exitCode = code === 0 && !signal ? 0 : (code && code > 0 ? code : 1);
  });
}
