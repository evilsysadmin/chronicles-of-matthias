import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioContext } from '../audioContext.js';
import { getChroniclesFxVolume } from './chroniclesAudioSettings.js';
import { unlockChroniclesActionAudio } from './chroniclesActionAudio.js';

vi.mock('../audioContext.js', () => ({ getAudioContext: vi.fn() }));
vi.mock('./chroniclesAudioSettings.js', () => ({ getChroniclesFxVolume: vi.fn() }));

describe('Chronicles impact audio gesture unlock', () => {
  beforeEach(() => {
    vi.mocked(getAudioContext).mockReset();
    vi.mocked(getChroniclesFxVolume).mockReset();
    vi.mocked(getChroniclesFxVolume).mockReturnValue(1);
  });

  it('resumes suspended WebAudio before delayed enemy and party hit cues', () => {
    const ctx = { state: 'suspended', resume: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(getAudioContext).mockReturnValue(ctx);

    expect(unlockChroniclesActionAudio()).toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('does not resume a running context or create one when effects are muted', () => {
    const ctx = { state: 'running', resume: vi.fn() };
    vi.mocked(getAudioContext).mockReturnValue(ctx);
    expect(unlockChroniclesActionAudio()).toBe(true);
    expect(ctx.resume).not.toHaveBeenCalled();

    vi.mocked(getChroniclesFxVolume).mockReturnValue(0);
    expect(unlockChroniclesActionAudio()).toBe(false);
    expect(getAudioContext).toHaveBeenCalledTimes(1);
  });

  it('degrades safely without WebAudio or when the browser rejects a resume', async () => {
    vi.mocked(getAudioContext).mockReturnValue(null);
    expect(unlockChroniclesActionAudio()).toBe(false);

    vi.mocked(getAudioContext).mockReturnValue({
      state: 'suspended',
      resume: vi.fn().mockRejectedValue(new Error('Autoplay restricted')),
    });
    expect(unlockChroniclesActionAudio()).toBe(true);
    await Promise.resolve();
  });
});
