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

// Reviewed, SHA-addressed R2 object: bucket chronicles,
// key sprites/ash-goblin-96ed70aafe94827f.webp. The immutable WebP's bytes
// and Cache-Control metadata were verified by Chess Studio's R2 operator
// workflow. Keep the locally packed, 5-frame goblin until its six-frame
// replacement actually loads and passes the dimension contract.
export const CHRONICLES_ASH_GOBLIN_R2_URL =
  'https://assets.chronicles.shadowops.dpdns.org/sprites/ash-goblin-96ed70aafe94827f.webp';

export const CHRONICLES_ASH_GOBLIN_R2_FRAMES = Object.freeze([
  'idle-a', 'idle-b', 'menace', 'attack', 'hurt', 'dead',
]);

export function chroniclesGoblinR2Url(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return null;
  try {
    const parsed = new URL(candidate.trim());
    if (parsed.protocol !== 'https:' || parsed.hostname === 'dash.cloudflare.com'
        || !/^\/sprites\/ash-goblin-[0-9a-f]{16}\.webp$/.test(parsed.pathname)
        || parsed.search || parsed.hash || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function chroniclesGoblinR2AtlasValid(image) {
  // The approved six-cell horizontal sheet is 1536×256; rejecting any
  // unexpected upload prevents frame UVs showing parts of adjacent poses.
  return image?.width === 1536 && image?.height === 256;
}

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

// Keep one decoded R2 source per URL for the entire browser session. Each
// billboard gets its own inexpensive Texture clone (independent frame UVs),
// while concurrent goblins share a single fetch and decode. Persistent HTTP
// caching is handled separately by the R2 object's Cache-Control response.
const remoteGoblinTextureCache = new Map();

function onRemoteGoblinAtlas(url, callback) {
  let entry = remoteGoblinTextureCache.get(url);
  if (entry) {
    if (entry.status === 'loaded') callback(entry.texture);
    else if (entry.status === 'loading') entry.subscribers.push(callback);
    return;
  }
  entry = { status: 'loading', subscribers: [callback], texture: null };
  remoteGoblinTextureCache.set(url, entry);
  new THREE.TextureLoader().load(url, (source) => {
    if (!chroniclesGoblinR2AtlasValid(source.image)) {
      source.dispose();
      entry.status = 'failed';
      entry.subscribers.length = 0;
      return;
    }
    source.colorSpace = THREE.SRGBColorSpace;
    source.magFilter = THREE.NearestFilter;
    source.minFilter = THREE.LinearMipmapLinearFilter;
    entry.status = 'loaded';
    entry.texture = source;
    const pending = entry.subscribers.splice(0);
    pending.forEach((subscriber) => subscriber(source));
  }, undefined, () => {
    // Remember failures for this tab, so dozens of enemies never trigger a
    // retry storm. Their local 5-frame placeholders remain active.
    entry.status = 'failed';
    entry.subscribers.length = 0;
  });
}

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
  let frames = spriteManifest[visualType]?.frames || [];
  if (!spec || !frames.length) return null;

  let idleFps = spec.idleFps;
  let texture = sheetTexture(spec.url, frames.length, Boolean(spriteManifest[visualType]?.pixelArt));
  let disposed = false;
  let lastTime = 0;
  let lastCues = {};
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
    lastTime = time;
    lastCues = cues;
    showFrame(chroniclesSpriteFrameIndex(frames, { ...cues, time, idleFps }));
  };
  group.userData.setChroniclesSpriteOpacity = (opacity) => {
    material.opacity = Math.max(0, Math.min(1, opacity));
  };
  group.userData.chroniclesDispose = () => {
    disposed = true;
    texture.dispose();
    material.dispose();
  };

  const goblinUrl = visualType === 'ash-goblin'
    ? chroniclesGoblinR2Url(import.meta.env.VITE_CHRONICLES_ASH_GOBLIN_URL || CHRONICLES_ASH_GOBLIN_R2_URL)
    : null;
  if (goblinUrl && typeof document !== 'undefined') {
    // Retain the complete local five-frame billboard until the six-frame R2
    // texture actually loads. A failed network/CORS request or a malformed
    // atlas leaves both the local art AND its correct five-frame UVs intact.
    onRemoteGoblinAtlas(goblinUrl, (source) => {
      if (disposed) return;
      const remote = source.clone();
      remote.repeat.set(1 / CHRONICLES_ASH_GOBLIN_R2_FRAMES.length, 1);
      remote.needsUpdate = true;
      const previous = texture;
      texture = remote;
      frames = CHRONICLES_ASH_GOBLIN_R2_FRAMES;
      idleFps = 0.8;
      material.map = remote;
      material.needsUpdate = true;
      group.userData.chroniclesBillboard.frames = frames;
      currentFrame = -1;
      group.userData.updateChroniclesSprite(lastTime, lastCues);
      previous.dispose();
    });
  }
  return group;
}
