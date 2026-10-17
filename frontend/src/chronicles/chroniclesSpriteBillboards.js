// 2.5D billboards for first-person Chronicles, Might and Magic III style:
// the world stays 3D (walls, forest, light, fog) while creatures and NPCs are
// painted sprites that always face the camera and swap frames for idle,
// menace and hurt. Sheets are SpriteCook-generated pixel art (or procedural
// placeholders drawn by api/cmd/spritegen) packed by spritegen too (one
// row, square cells).
import * as THREE from 'three';
import spriteManifest from '../assets/chronicles/sprites/sprites.json';

// Every packed sheet next to sprites.json, keyed by sprite id. World height
// and idle speed come from the manifest that api/cmd/spritegen writes.
const SHEETS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/chronicles/sprites/*.webp', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.split('/').pop().replace(/\.webp$/, ''), url]),
);

const SPRITES = Object.freeze(Object.fromEntries(
  Object.entries(spriteManifest)
    .filter(([id]) => SHEETS[id])
    .map(([id, entry]) => [id, Object.freeze({
      url: SHEETS[id],
      worldHeight: Number(entry.worldHeight) || 2.5,
      idleFps: Number(entry.idleFps) || 1.6,
    })]),
));

export function chroniclesHasSpriteBillboard(visualType) {
  return Boolean(SPRITES[visualType] && spriteManifest[visualType]?.frames?.length);
}

// Cue priority: dead > hurt > attack > menace > grateful > speak > idle.
export function chroniclesSpriteFrameIndex(frames, {
  time = 0, dead = false, hurt = false, attacking = false, menace = false,
  grateful = false, speaking = false, idleFps = 2,
} = {}) {
  const pick = [
    [dead, 'dead'], [hurt, 'hurt'], [attacking, 'attack'], [menace, 'menace'],
    [grateful, 'grateful'], [speaking, 'speak'],
  ].find(([on, id]) => on && frames.includes(id));
  if (pick) return frames.indexOf(pick[1]);
  const idle = ['idle-a', 'idle-b'].map((id) => frames.indexOf(id)).filter((index) => index >= 0);
  if (!idle.length) return 0;
  return idle[Math.floor(Math.max(0, time) * idleFps) % idle.length];
}

const textureCache = new Map();

function sheetTexture(url, frameCount, pixelArt) {
  if (!textureCache.has(url)) {
    // Headless (tests/SSR) gets an empty texture; browsers load the sheet.
    const texture = typeof document === 'undefined' ? new THREE.Texture() : new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Pixel-art sheets keep their VGA grid up close; minification still
    // mipmaps so distant creatures don't shimmer.
    texture.magFilter = pixelArt ? THREE.NearestFilter : THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    textureCache.set(url, texture);
  }
  const texture = textureCache.get(url).clone();
  texture.repeat.set(1 / frameCount, 1);
  texture.needsUpdate = true;
  return texture;
}

// A creature/NPC as a camera-facing sprite standing on its cell. The group
// keeps the enemy runtime contract (position, scale, visibility) and exposes
// `updateChroniclesSprite(time, cues)` for frame selection.
export function buildChroniclesSpriteBillboard(visualType, { tint = 0xffffff } = {}) {
  const spec = SPRITES[visualType];
  const frames = spriteManifest[visualType]?.frames || [];
  if (!spec || !frames.length) return null;

  const texture = sheetTexture(spec.url, frames.length, Boolean(spriteManifest[visualType]?.pixelArt));
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: tint,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    fog: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0.03);
  sprite.scale.set(spec.worldHeight, spec.worldHeight, 1);
  sprite.name = `chronicles-sprite-${visualType}`;
  sprite.renderOrder = 2;

  const group = new THREE.Group();
  group.name = `chronicles-billboard-${visualType}`;
  group.add(sprite);
  let currentFrame = -1;
  const showFrame = (index) => {
    if (index === currentFrame) return;
    currentFrame = index;
    texture.offset.set(index / frames.length, 0);
  };
  showFrame(0);
  group.userData.chroniclesBillboard = { visualType, frames, sprite };
  group.userData.updateChroniclesSprite = (time, cues = {}) => {
    showFrame(chroniclesSpriteFrameIndex(frames, { ...cues, time, idleFps: spec.idleFps }));
  };
  group.userData.setChroniclesSpriteOpacity = (opacity) => {
    material.opacity = Math.max(0, Math.min(1, opacity));
  };
  group.userData.chroniclesDispose = () => {
    texture.dispose();
    material.dispose();
  };
  return group;
}
