import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name) => readFileSync(new URL('../assets/chronicles/ui/shops/' + name, import.meta.url));

function webpDimensions(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('Not a RIFF WebP');
  }
  for (let p = 12; p + 8 <= buf.length;) {
    const kind = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    const at = p + 8;
    if (at + size > buf.length) throw new Error('Truncated WebP chunk');
    if (kind === 'VP8X' && size >= 10) {
      return { width: 1 + buf.readUIntLE(at + 4, 3), height: 1 + buf.readUIntLE(at + 7, 3) };
    }
    if (kind === 'VP8 ' && size >= 10 && buf[at + 3] === 0x9d && buf[at + 4] === 1 && buf[at + 5] === 0x2a) {
      return { width: buf.readUInt16LE(at + 6) & 0x3fff, height: buf.readUInt16LE(at + 8) & 0x3fff };
    }
    if (kind === 'VP8L' && size >= 5 && buf[at] === 0x2f) {
      return {
        width: 1 + (((buf[at + 2] & 0x3f) << 8) | buf[at + 1]),
        height: 1 + (((buf[at + 4] & 0x0f) << 10) | (buf[at + 3] << 2) | (buf[at + 2] >> 6)),
      };
    }
    p = at + size + (size % 2);
  }
  throw new Error('WebP has no recognized image bitstream');
}

function expectPanorama(width, height) {
  expect(width).toBeGreaterThanOrEqual(1500);
  expect(height).toBeGreaterThanOrEqual(800);
  expect(width / height).toBeGreaterThanOrEqual(1.55);
  expect(width / height).toBeLessThanOrEqual(2.05);
}

describe('Shop environment artwork acceptance', () => {
  it('the pictorial Brunna reference is still local, optimized, and panoramic', () => {
    const bytes = source('brunna-forge.webp');
    expect(bytes.length).toBeLessThan(700_000);
    const { width, height } = webpDimensions(bytes);
    expectPanorama(width, height);
    expect(width).toBe(1672);
    expect(height).toBe(941);
  });

  for (const name of ['odo-armory.svg', 'guild-archive.svg', 'botica-apothecary.svg']) {
    it(name + ': wide clean environment without rendered UI or remote dependencies', () => {
      const bytes = source(name);
      expect(bytes.length).toBeLessThan(700_000);
      const svg = bytes.toString('utf8');
      expect(svg).toMatch(/^<svg(?:\s|>)/);
      const vb = svg.match(/\bviewBox="0 0 ([\d.]+) ([\d.]+)"/);
      expect(vb).not.toBeNull();
      expectPanorama(Number(vb[1]), Number(vb[2]));
      expect(svg).not.toMatch(/<\s*(?:text|foreignObject|script|image|a)(?:\s|>)/i);
      expect(svg).not.toMatch(/(?:href\s*=\s*["']\s*(?:https?:|data:)|url\(\s*["']?https?:)/i);
    });
  }

  it('rejects wrong and truncated WebP headers', () => {
    expect(() => webpDimensions(Buffer.from('not WebP'))).toThrow('Not a RIFF WebP');
    const bad = Buffer.alloc(28);
    bad.write('RIFF', 0, 'ascii');
    bad.write('WEBP', 8, 'ascii');
    bad.write('VP8X', 12, 'ascii');
    bad.writeUInt32LE(100, 16);
    expect(() => webpDimensions(bad)).toThrow('Truncated WebP chunk');
  });
});
