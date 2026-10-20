import { describe, expect, it, vi } from 'vitest';
import { beginSilentSsoRestore } from './ssoRestoreGate.js';

const tick = () => Promise.resolve().then(() => Promise.resolve());

describe('silent SSO loader gate', () => {
  it('enters the game only on confirmed restoration', async () => {
    const result = vi.fn();
    beginSilentSsoRestore(() => Promise.resolve(true), result);
    await tick();
    expect(result).toHaveBeenCalledExactlyOnceWith('authenticated');
  });

  it('shows the manual login on normal absence or a rejected restore', async () => {
    for (const [restore, expected] of [
      [() => Promise.resolve(false), 'anonymous'],
      [() => Promise.reject(new Error('Session storage unavailable')), 'error'],
    ]) {
      const result = vi.fn();
      beginSilentSsoRestore(restore, result);
      await tick();
      expect(result).toHaveBeenCalledExactlyOnceWith(expected);
    }
  });

  it('recovers from a hung restore and ignores a late success', async () => {
    let settle;
    let signal;
    let timeout;
    const result = vi.fn();
    beginSilentSsoRestore(({ signal: current }) => {
      signal = current;
      return new Promise((resolve) => { settle = resolve; });
    }, result, { setTimer: (fn) => { timeout = fn; return 1; }, clearTimer: () => {} });
    await tick();
    timeout();
    expect(signal.aborted).toBe(true);
    expect(result).toHaveBeenCalledExactlyOnceWith('timeout');
    settle(true);
    await tick();
    expect(result).toHaveBeenCalledTimes(1);
  });

  it('aborts on unmount and ignores stale asynchronous results', async () => {
    let settle;
    let signal;
    const result = vi.fn();
    const cancel = beginSilentSsoRestore(({ signal: current }) => {
      signal = current;
      return new Promise((resolve) => { settle = resolve; });
    }, result);
    await tick();
    cancel();
    expect(signal.aborted).toBe(true);
    settle(true);
    await tick();
    expect(result).not.toHaveBeenCalled();
  });
});
