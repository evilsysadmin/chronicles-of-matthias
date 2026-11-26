import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chroniclesPixelTexture } from './chroniclesPixelTextures.js';

describe('Terra coastal sand ripples', () => {
  it('preserves the small opaque repeating atlas and cached texture identity', () => {
    const texture = chroniclesPixelTexture('sand');
    expect(chroniclesPixelTexture('sand')).toBe(texture);
    expect(texture.userData.chroniclesPixelArt).toEqual({ kind: 'sand', size: 64, palette: 5 });
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.image.data.length).toBe(64 * 64 * 4);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.generateMipmaps).toBe(true);
    const tones = new Set();
    for (let i = 0; i < texture.image.data.length; i += 4) {
      expect(texture.image.data[i + 3]).toBe(255);
      tones.add(texture.image.data[i]);
    }
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });

  it('has directional wind ripples beyond the four-pixel dither pattern', () => {
    const { data, width } = chroniclesPixelTexture('sand').image;
    const at = (x, y) => data[((y % width) * width + x % width) * 4];
    let along = 0, across = 0;
    // Compare the same Bayer phase, including the repeating tile boundary.
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        along += Math.abs(at(x, y) - at(x + 4, y));
        across += Math.abs(at(x, y) - at(x, y + 4));
      }
    }
    expect(across).toBeGreaterThan(along * 1.8);
    expect(along).toBeGreaterThan(0);
  });
});
