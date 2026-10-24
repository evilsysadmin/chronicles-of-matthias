import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth.js', () => ({
  authHeader: () => ({ Authorization: 'Bearer test-session' }),
}));
vi.mock('../http.js', () => ({
  requestJson: vi.fn(),
}));
import { requestJson } from '../http.js';
import {
  CHRONICLES_FEEDBACK_CATEGORIES, prepareChroniclesFeedback,
  readChroniclesFeedback, sendChroniclesFeedback,
} from './chroniclesFeedbackMailbox.js';

describe('Chronicles feedback mailbox', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('accepts only bounded categories and meaningful messages', () => {
    expect(Object.keys(CHRONICLES_FEEDBACK_CATEGORIES)).toEqual(['bug', 'idea', 'ux', 'other']);
    expect(prepareChroniclesFeedback('idea', '  Nueva taberna  ')).toEqual({
      category: 'idea', message: 'Nueva taberna',
      context: 'Chronicles · Menú de aventura',
    });
    expect(() => prepareChroniclesFeedback('admin', 'Hola')).toThrow('categoría');
    expect(() => prepareChroniclesFeedback('bug', '  x  ')).toThrow('tres');
    expect(() => prepareChroniclesFeedback('ux', '🙂'.repeat(2001))).toThrow('2000');
    expect(prepareChroniclesFeedback('bug', '🙂'.repeat(2000)).message).toHaveLength(4000);
  });

  it('submits to the game API with bearer auth, no screenshot or run payload', async () => {
    requestJson.mockResolvedValue({ feedback: { id: 'c1', category: 'bug' } });
    await sendChroniclesFeedback('bug', '  Hay un muro invisible  ');
    expect(requestJson).toHaveBeenCalledTimes(1);
    const [url, options] = requestJson.mock.calls[0];
    expect(url).toMatch(/\/api\/feedback$/);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json', Authorization: 'Bearer test-session',
    });
    expect(JSON.parse(options.body)).toEqual({
      category: 'bug', message: 'Hay un muro invisible',
      context: 'Chronicles · Menú de aventura',
    });
    expect(options.body).not.toContain('screenshot');
    expect(options.body).not.toContain('runId');
  });

  it('reads only authenticated current-user history', async () => {
    requestJson.mockResolvedValue({ feedback: [{ id: 'c1', message: 'Hola' }] });
    expect(await readChroniclesFeedback()).toEqual([{ id: 'c1', message: 'Hola' }]);
    const [url, options] = requestJson.mock.calls[0];
    expect(url).toMatch(/\/api\/feedback\/mine$/);
    expect(options.headers.Authorization).toBe('Bearer test-session');
    expect(options.body).toBeUndefined();
    requestJson.mockResolvedValue({});
    expect(await readChroniclesFeedback()).toEqual([]);
  });

  it('never sends a request for rejected content', () => {
    expect(() => sendChroniclesFeedback('bug', 'x')).toThrow('tres');
    expect(requestJson).not.toHaveBeenCalled();
  });
});
