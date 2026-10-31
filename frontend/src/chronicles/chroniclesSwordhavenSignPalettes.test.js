import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSwordhavenScene, SWORDHAVEN_BUILDINGS } from './chroniclesSwordhaven3D.js';

function rgb(texture, x, y) {
  const { data, width } = texture.image;
  const offset = (y * width + x) * 4;
  return [...data.slice(offset, offset + 3)];
}

function brightness(color) {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

describe('Swordhaven service-specific shop signs', () => {
  it('uses distinct readable palettes on the five canonical shop facades', () => {
    const scene = new THREE.Scene();
    buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: true });
    const backgrounds = new Set();
    for (const spec of SWORDHAVEN_BUILDINGS) {
      const building = scene.getObjectByName('swordhaven-building-' + spec.id);
      const lettering = building.getObjectByName('shop-nameplate-lettering');
      const texture = lettering.material.map;
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.image.width).toBe(256);
      expect(texture.image.height).toBe(64);
      expect(building.getObjectByName('shop-nameplate-wood')).toBeTruthy();
      expect(building.getObjectByName('shop-nameplate-brass')).toBeTruthy();
      const border = rgb(texture, 1, 1);
      const background = rgb(texture, 10, 10);
      backgrounds.add(background.join(','));
      expect(border).not.toEqual(background);
      // Find a real foreground glyph, not a painted border or background.
      let glyph;
      for (let y = 8; y < 56 && !glyph; y += 1) {
        for (let x = 12; x < 244; x += 1) {
          const pixel = rgb(texture, x, y);
          if (pixel.join(',') !== background.join(',') && pixel.join(',') !== border.join(',')) {
            glyph = pixel;
            break;
          }
        }
      }
      expect(glyph).toBeDefined();
      expect(brightness(glyph) - brightness(background)).toBeGreaterThan(90);
    }
    expect(backgrounds.size).toBe(SWORDHAVEN_BUILDINGS.length);
  });

  it('reuses a cached sign atlas without altering the collision or sign contract', () => {
    const scenes = [new THREE.Scene(), new THREE.Scene()];
    for (const scene of scenes) {
      buildSwordhavenScene(scene, { scenePlan: { content: [] }, coarsePointer: true });
    }
    for (const spec of SWORDHAVEN_BUILDINGS) {
      const first = scenes[0].getObjectByName('swordhaven-building-' + spec.id);
      const second = scenes[1].getObjectByName('swordhaven-building-' + spec.id);
      expect(first.getObjectByName('shop-nameplate-lettering').material.map)
        .toBe(second.getObjectByName('shop-nameplate-lettering').material.map);
      expect(first.getObjectByName('swordhaven-interaction-' + spec.id)
        .userData.chroniclesContentId).toBe(spec.id);
      expect(first.getObjectByName('shop-door')).toBeTruthy();
    }
  });
});
