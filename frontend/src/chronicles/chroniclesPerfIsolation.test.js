import { describe, expect, it } from 'vitest';
import {
  chroniclesPerfIsolationFlags,
  chroniclesPerfTorchesVisible,
} from './chroniclesPerfIsolation.js';

describe('Chronicles local CPU isolation flags', () => {
  it('leaves normal play unchanged regardless of unrelated query switches', () => {
    expect(chroniclesPerfIsolationFlags('')).toEqual({
      disableMusic: false, disableTorchGlows: false,
    });
    expect(chroniclesPerfIsolationFlags('?chroniclesMusic=0&chroniclesTorches=0'))
      .toEqual({ disableMusic: false, disableTorchGlows: false });
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=0&chroniclesMusic=0'))
      .toEqual({ disableMusic: false, disableTorchGlows: false });
  });

  it('isolates MP3 and torch CSS glow independently only in explicit diagnostics', () => {
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=1'))
      .toEqual({ disableMusic: false, disableTorchGlows: false });
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=1&chroniclesMusic=0'))
      .toEqual({ disableMusic: true, disableTorchGlows: false });
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=1&chroniclesTorches=0'))
      .toEqual({ disableMusic: false, disableTorchGlows: true });
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=1&chroniclesMusic=0&chroniclesTorches=0'))
      .toEqual({ disableMusic: true, disableTorchGlows: true });
  });

  it('does not disable underlying lighting or unhide glows in background tabs', () => {
    expect(chroniclesPerfTorchesVisible(true, false)).toBe(true);
    expect(chroniclesPerfTorchesVisible(true, true)).toBe(false);
    expect(chroniclesPerfTorchesVisible(false, false)).toBe(false);
    expect(chroniclesPerfTorchesVisible(false, true)).toBe(false);
  });

  it('does not parse substring lookalikes as enabled options', () => {
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=true&chroniclesMusic=0'))
      .toEqual({ disableMusic: false, disableTorchGlows: false });
    expect(chroniclesPerfIsolationFlags('?chroniclesPerf=1&chroniclesMusic=off&chroniclesTorches=false'))
      .toEqual({ disableMusic: false, disableTorchGlows: false });
  });
});
