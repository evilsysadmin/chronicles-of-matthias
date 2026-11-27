import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

describe('Terra heath ground and compacted sediment', () => {
  it.each(['heath', 'heathpath'])('filters %s at grazing angles without losing its cached pixel atlas', kind => {
    const texture = chroniclesPixelTexture(kind);
    expect(texture).toBe(chroniclesPixelTexture(kind));
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.anisotropy).toBe(4);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('keeps compacted paths warm and readable without large dark or green islands', () => {
    const { data } = chroniclesPixelTexture('heathpath').image;
    let moss = 0, dark = 0;
    const tones = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = data.subarray(i, i + 4);
      expect(a).toBe(255);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
      if (r === 119 && g === 119 && b === 95) moss++;
      if (r < 100) dark++;
      tones.add(r * 65536 + g * 256 + b);
    }
    expect(tones.size).toBeGreaterThan(5);
    expect(moss).toBeGreaterThan(0);
    expect(moss).toBeLessThan(200);
    expect(dark).toBeLessThan(200);
  });
});
