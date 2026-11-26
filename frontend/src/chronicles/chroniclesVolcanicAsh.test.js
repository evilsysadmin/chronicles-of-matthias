import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

describe('Terra volcanic ash plates', () => {
  it('retains the existing small opaque repeatable atlas', () => {
    const texture = chroniclesPixelTexture('ashland');
    expect(chroniclesPixelTexture('ashland')).toBe(texture);
    expect(texture.userData.chroniclesPixelArt).toEqual({ kind: 'ashland', size: 64, palette: 5 });
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.generateMipmaps).toBe(true);
  });

  it('keeps mineral fractures subdued and cinders sparse', () => {
    const { data, width } = chroniclesPixelTexture('ashland').image;
    const tones = new Set();
    let dark = 0, cinders = 0;
    for (let i = 0; i < data.length; i += 4) {
      const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      expect(data[i + 3]).toBe(255);
      if (rgb === 0xd8641e) cinders++;
      else {
        expect([0x2e2826, 0x463c38, 0x5e524c, 0x786a62, 0x94847a]).toContain(rgb);
        tones.add(rgb);
      }
      if (rgb === 0x2e2826) dark++;
    }
    expect(tones.size).toBeGreaterThanOrEqual(4);
    expect(dark).toBeGreaterThan(0);
    expect(dark).toBeLessThan(width * width * 0.05);
    expect(cinders).toBeGreaterThan(0);
    expect(cinders).toBeLessThan(width * width * 0.005);
  });
});
