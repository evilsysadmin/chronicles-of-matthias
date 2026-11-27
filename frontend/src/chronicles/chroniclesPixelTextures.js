import * as THREE from 'three';

// MM3-style pixel-art surfaces for the 3D overworld. Every tile is small
// (32–64 px), built from a short hand-picked colour ramp per material and
// quantised with a 4×4 Bayer matrix, so walls, roads and meadows share the
// chunky VGA pixel of the painted billboards. Deterministic and generated in
// memory: no downloads, one cached texture per kind.

const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map(v => (v + 0.5) / 16 - 0.5);

function hash(x, y, salt = 0) {
  let n = Math.imul(x + 374761393 + salt * 668265263, 0x27d4eb2d) ^ Math.imul(y + 668265263, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x85ebca6b);
  return ((n ^ (n >>> 13)) >>> 0) / 0xffffffff;
}

// Smooth tileable value noise over `cells` lattice cells across the tile.
function valueNoise(x, y, size, cells, salt) {
  const u = x * cells / size;
  const v = y * cells / size;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = (u - x0) ** 2 * (3 - 2 * (u - x0));
  const fy = (v - y0) ** 2 * (3 - 2 * (v - y0));
  const s = (dx, dy) => hash((x0 + dx) % cells, (y0 + dy) % cells, salt);
  const a = s(0, 0) * (1 - fx) + s(1, 0) * fx;
  const b = s(0, 1) * (1 - fx) + s(1, 1) * fx;
  return a * (1 - fy) + b * fy;
}

const hex = value => [(value >> 16) & 255, (value >> 8) & 255, value & 255];

// Dark → light ramps. Surfaces tinted by a material colour stay near-neutral
// so roofs/plaster keep their per-building hue; grass carries its own greens.
const RAMPS = Object.freeze({
  grass: [0x24461a, 0x335f22, 0x45782a, 0x5a8f33, 0x76a840, 0x93bd52].map(hex),
  // Banner Road meadow: less black/green pixel contrast than town grass,
  // with midtone olive/sage patches and subtle dry summer grass.
  meadow: [0x304a2c, 0x435a35, 0x536d40, 0x677e4c, 0x758957, 0x899d6b].map(hex),
  // Generic Terra meadows: gentler mid-tone olive grasses, without the
  // large flat, dark peat islands useful in Banner Road's woodland.
  // Separate cached 128px atlas: the authored Banner Road stays identical.
  terrafield: [0x526843, 0x60764c, 0x708658, 0x809668, 0x91a477, 0xa4b58a].map(hex),
  // Banner Road only: compressed loam and small gravel, never masonry joints.
  woodlandpath: [0x4a4634, 0x5f543b, 0x766447, 0x8a7755, 0xa08d67, 0xb2a07e].map(hex),
  masonry: [0x4a4440, 0x8a8178, 0xb3aa9c, 0xd4cbbb, 0xeee6d6, 0xfff9ec].map(hex),
  stucco: [0xa99c88, 0xd9cfbf, 0xeae2d4, 0xf6efe3, 0xfffaf0].map(hex),
  timber: [0x5a4a3a, 0x8f7a63, 0xb59f86, 0xd2bea4, 0xeadbc4].map(hex),
  roof: [0x5c5650, 0x9a928a, 0xc4bcb2, 0xe2dbd1, 0xfbf6ee].map(hex),
  cobble: [0x4b453d, 0x7d7468, 0xa59b8c, 0xc8bfae, 0xe6dece].map(hex),
  bark: [0x3a2a1c, 0x5e4630, 0x7f6244, 0x9c7d5a].map(hex),
  // C3: ash-brown weathered plates, readable in the existing forest shade.
  woodlandbark: [0x514235, 0x695745, 0x806b53, 0x978365, 0xb19b7a, 0xc3ad8b].map(hex),
  leaves: [0x1f3a19, 0x2f5223, 0x416b2d, 0x58843a, 0x75a04a].map(hex),
  // C3 broadleaf albedo: lift near-black gaps and temper saturated greens.
  // Same clump field and five-level pixel-art ramp, not emissive lighting.
  // v110: real v109 framebuffer shows almost black near foliage.
  // Lift the shadow and middle pigments, keeping muted yellow-green tips.
  woodlandleaves: [0x405b32, 0x547044, 0x698751, 0x809b60, 0x98ac72].map(hex),
  // Terra grounds: same meadow noise as grass, without blades or flowers.
  snow: [0x8f9cb0, 0xb6c2d2, 0xd2dbe6, 0xe6edf4, 0xf6f9fc].map(hex),
  sand: [0x9c8458, 0xbea477, 0xd6c091, 0xe8d6aa, 0xf4e8c6].map(hex),
  ashland: [0x2e2826, 0x463c38, 0x5e524c, 0x786a62, 0x94847a].map(hex),
  // B2 heath: muted peat, weathered earth and lichen, not bright meadow green.
  heath: [0x33382e, 0x4c503b, 0x626448, 0x7f7555, 0x999173, 0xb1a587].map(hex),
  // Compacted peat path, quieter and warmer than Swordhaven cobblestones.
  heathpath: [0x35382f, 0x554e3d, 0x71634b, 0x8c795e, 0xa59378, 0xb7a68a].map(hex),
  ashpath: [0x393332, 0x514744, 0x685c57, 0x80716a, 0x97877f, 0xaf9f96].map(hex),
  // Neutral weathered stone for boulders and crags; materials tint it per biome.
  rock: [0x3c3a38, 0x5e5b56, 0x827e76, 0xa8a399, 0xcbc6ba, 0xe8e4da].map(hex),
  // Native Terra highlands: weathered sandstone/slate, with restrained
  // variation rather than the urban rock atlas's black checkerboard cracks.
  uplandrock: [0x777b70, 0x888d80, 0x9ca091, 0xadb0a0, 0xbcbfac, 0xcbcbb9].map(hex),
  // Marsh floor: brown peat, grey-green moss and weathered reed litter.
  marshpeat: [0x393a30, 0x4d4d3e, 0x605d49, 0x73715b, 0x86836c, 0x9a987d].map(hex),
  // Cold saline pools with dark peat, grey-green shallows and muted glints.
  bogwater: [0x11211f, 0x1b302d, 0x29463f, 0x38584e, 0x4a6b5f, 0x688176].map(hex),
});

const SIZES = Object.freeze({
  grass: 64, meadow: 128, terrafield: 128, woodlandpath: 128, masonry: 64, stucco: 32, timber: 32, roof: 32, cobble: 64, bark: 32, woodlandbark: 64, leaves: 32, woodlandleaves: 32,
  snow: 64, sand: 64, ashland: 64, heath: 64, heathpath: 64, ashpath: 64, marshpeat: 64, bogwater: 64, rock: 32, uplandrock: 64,
});

// Returns a light value (≈0..1, dithered onto the ramp), SEAM (darkest ramp
// colour, for mortar and gaps) or { color } for an off-ramp accent pixel.
const SEAM = Object.freeze({ index: 0 });
function sample(kind, x, y, size) {
  const grain = hash(x, y, 3) - 0.5;
  if (kind === 'grass') {
    const meadow = valueNoise(x, y, size, 4, 1) - 0.5;
    const clover = valueNoise(x, y, size, 11, 2) - 0.5;
    // Short dark blades with a lit tip, scattered on a 4-px grid.
    const bx = x % 4;
    const by = y % 6;
    const blade = hash(Math.floor(x / 4), Math.floor(y / 6), 9);
    if (blade > 0.72 && bx === 1 && by < 3) return by === 0 ? 0.92 : 0.12;
    const flower = hash(x, y, 17);
    if (flower > 0.9965) return { color: flower > 0.9985 ? 0xf2ead2 : 0xe6c84a };
    return 0.52 + meadow * 0.55 + clover * 0.25 + grain * 0.18;
  }
  if (kind === 'terrafield') {
    // Multi-scale, tileable field noise replaces giant black-green blobs:
    // smaller clover/lichen islands interrupt broader sward without hard
    // binary thresholds that turn whole areas into one flat dark colour.
    // The subtle soil grit is pixel-scale, never a large solid patch.
    const sward = valueNoise(x, y, size, 7, 201) - 0.5;
    const clover = valueNoise(x, y, size, 19, 202) - 0.5;
    const moss = valueNoise(x, y, size, 31, 203) - 0.5;
    const grit = valueNoise(x, y, size, 43, 204) - 0.5;
    if (clover < -0.23 && moss < -0.12 && hash(x, y, 205) > 0.75) {
      return { color: 0x897e61 }; // Sparse, detached earth flecks.
    }
    if (moss > 0.19 && grit > 0.11) {
      return { color: 0xa3ab7c }; // Sunlit lichen, not white speckles.
    }
    return 0.52 + sward * 0.34 + clover * 0.32 + moss * 0.22
      + grit * 0.11 + grain * 0.07;
  }
  if (kind === 'meadow') {
    // A grassy forest floor needs more than a smooth green tint. Layer broad
    // sward, finer clover and damp moss, then let a minority of irregular
    // patches reveal warm compacted soil. All fields are periodic, so the
    // same 128px atlas can repeat without seams or texture downloads.
    const sward = valueNoise(x, y, size, 4, 91) - 0.5;
    const clover = valueNoise(x, y, size, 13, 92) - 0.5;
    // A finer lattice breaks the big periodic brown islands into smaller
    // irregular pockets. This texture is used only by Banner Road.
    const loam = valueNoise(x, y, size, 11, 94) - 0.5;
    const moss = valueNoise(x, y, size, 9, 95) - 0.5;
    // C3 v77: 27/29-cell micrograin gives the broad soil and grass patches
    // readable internal detail instead of a solid painted colour at eye
    // height. Both fields repeat seamlessly within the SAME cached 128px
    // meadow atlas. Keep the original soil-mask threshold and coverage.
    const fine = valueNoise(x, y, size, 27, 97) - 0.5;
    const crumb = valueNoise(x, y, size, 29, 98) - 0.5;
    if (loam < -0.22 && clover < 0.02) {
      // Every soil pixel stays soil, so the authored amount of visible loam
      // and its broken islands remain identical; only their inner grain
      // gains muted warm/neutral variation without the pale beige blotches.
      const tint = crumb > 0.12 ? 0x878166
        : crumb < -0.10 ? 0x6d6952
          : loam < -0.29 ? 0x756f57 : 0x807e62;
      return { color: tint };
    }
    if (sward > 0.11 && moss > -0.04) {
      return { color: fine > 0.12 ? 0x90a078 : 0x7a9064 };
    }
    if (sward < -0.15 && moss > 0.07) {
      return { color: fine > 0.12 ? 0x516b4b : 0x405b3c };
    }
    // Fine tufts soften the terrain at eye level while the 3D grass adds
    // actual silhouettes. No shadow, animation or second ground material.
    const blade = hash(Math.floor(x / 5), Math.floor(y / 7), 96);
    if (sward > -0.15 && blade > 0.79 && x % 5 === 2 && y % 7 < 3) {
      return y % 7 === 0 ? { color: 0x9fa976 } : 0.31 + moss * 0.15;
    }
    if (hash(x, y, 93) > 0.9982) return { color: 0xa9a17a };
    return 0.51 + sward * 0.34 + clover * 0.22 + moss * 0.15
      + fine * 0.17 + grain * 0.08;
  }
  if (kind === 'woodlandpath') {
    // Irregular soil, compacted tread, and sparse pebbles use periodic
    // lattices so neighbouring 4m trail cells meet without obvious seams.
    // A true dirt track replaces the repeated town cobblestones, with zero
    // new geometry, shader, requests or simulation state.
    const soil = valueNoise(x, y, size, 5, 141) - 0.5;
    const tread = valueNoise(x, y, size, 13, 142) - 0.5;
    const gravel = valueNoise(x, y, size, 26, 143) - 0.5;
    const moss = valueNoise(x, y, size, 9, 144) - 0.5;
    // Broken, dusty lichen flecks rather than large solid paint-green
    // islands across the middle of the cart track. A 4px grain mask reduces
    // the footprint without changing the atlas, dirt road or draw budget.
    if (moss > 0.14 && soil < -0.01
      && hash(Math.floor(x / 4), Math.floor(y / 4), 145) > 0.63) {
      return { color: 0x77765e };
    }
    if (hash(x, y, 148) > 0.987 && gravel > -0.12) return { color: 0xaea18c };
    if (hash(x, y, 149) > 0.991 && soil < 0.10) return { color: 0x4c4939 };
    return 0.49 + soil * 0.45 + tread * 0.20 + gravel * 0.11 + grain * 0.08;
  }
  if (kind === 'heath') {
    // Four-octave-style deterministic ground breakup: dark peat patches,
    // olive moss, and sparse lilac heather litter. Tileable without asset I/O.
    const peat = valueNoise(x, y, size, 4, 44) - 0.5;
    const grit = valueNoise(x, y, size, 11, 45) - 0.5;
    const fleck = hash(x, y, 46);
    if (peat < -0.16 && grit < 0.08) return 0.13;
    if (peat > 0.10 && grit > -0.06) return { color: 0x707b57 };
    if (fleck > 0.996) return { color: 0x987c95 };
    if (fleck < 0.012) return { color: 0x8b8576 };
    return 0.51 + peat * 0.56 + grit * 0.20 + grain * 0.12;
  }
  if (kind === 'heathpath') {
    // Fine foot-worn earth: muted sediment, sparse pebbles and moss at the
    // margins. Tileable and deterministic, no raised cobble seams.
    const soil = valueNoise(x, y, size, 4, 48) - 0.5;
    const grit = valueNoise(x, y, size, 12, 49) - 0.5;
    const fleck = hash(x, y, 50);
    if (soil < -0.23 && grit < 0.04) return 0.12;
    if (soil > 0.20 && grit > 0.02) return { color: 0x747c58 };
    if (fleck > 0.994) return { color: 0x8b887b };
    return 0.54 + soil * 0.48 + grit * 0.19 + grain * 0.1;
  }
  if (kind === 'ashpath') {
    // Foot-worn volcanic dust, compacted charcoal and scattered basalt grit.
    // No moss from the shared heath track, or glowing lava on walkable cells.
    const dust = valueNoise(x, y, size, 5, 311) - 0.5;
    const compacted = valueNoise(x, y, size, 13, 312) - 0.5;
    const grit = valueNoise(x, y, size, 25, 313) - 0.5;
    const fleck = hash(x, y, 314);
    if (fleck < 0.025 && compacted < 0.08) return { color: 0x514744 };
    if (fleck > 0.986 && dust > -0.18) return { color: 0x97877f };
    return 0.54 + dust * 0.42 + compacted * 0.22 + grit * 0.16 + grain * 0.07;
  }
  if (kind === 'marshpeat') {
    // Broad wet peat pockets and muted moss, broken by finer sediment.
    // No meadow flowers or bright grass blades in the saturated soil.
    const peat = valueNoise(x, y, size, 4, 301) - 0.5;
    const moss = valueNoise(x, y, size, 9, 302) - 0.5;
    const grit = valueNoise(x, y, size, 21, 303) - 0.5;
    if (peat < -0.16 && moss < 0.06) return 0.18 + grit * 0.12;
    if (moss > 0.17 && peat > -0.12) return { color: 0x777f60 };
    if (hash(x, y, 304) > 0.987 && peat > -0.15) return { color: 0x9b9274 };
    return 0.54 + peat * 0.42 + moss * 0.18 + grit * 0.18 + grain * 0.07;
  }
  if (kind === 'bogwater') {
    // Tileable, static dark-water breakup; concentric-looking ripples are
    // suggested by overlapping periodic waves, never animated or fetched.
    // Very sparse silt glints keep water legible without bright neon bands.
    const depth = valueNoise(x, y, size, 4, 71) - 0.5;
    const shoal = valueNoise(x, y, size, 9, 72) - 0.5;
    const phase = (x * 3 + y * 2) * Math.PI * 2 / size;
    const ripples = Math.sin(phase + shoal * 3) * 0.045
      + Math.cos((x - y) * Math.PI * 4 / size) * 0.025;
    if (hash(x, y, 73) > 0.9985) return { color: 0x85988a };
    return 0.46 + depth * 0.62 + shoal * 0.2 + ripples + grain * 0.08;
  }
  if (kind === 'uplandrock') {
    // Three periodic scales blend sediment and wind-worn mineral deposits.
    // Low-amplitude diagonal strata provide direction without sharp black
    // fissure masks, repeated square cells or bright pixel-grid edges.
    const strata = valueNoise(x, y, size, 5, 281) - 0.5;
    const weather = valueNoise(x, y, size, 13, 282) - 0.5;
    const flecks = valueNoise(x, y, size, 27, 283) - 0.5;
    const sweep = Math.sin((x * 0.39 + y * 0.17) + strata * 4) * 0.045;
    if (hash(x, y, 284) > 0.997 && weather > 0.07) {
      return { color: 0xa8ab92 }; // A rare weathered lichen fleck.
    }
    return 0.54 + strata * 0.37 + weather * 0.28
      + flecks * 0.17 + sweep + grain * 0.06;
  }
  if (kind === 'rock') {
    // Lichen-flecked stone with a few dark fissures.
    const mass = valueNoise(x, y, size, 4, 27) - 0.5;
    const fissure = Math.abs(valueNoise(x, y, size, 6, 29) - 0.5) < 0.035;
    if (fissure) return 0.04;
    if (hash(x, y, 31) > 0.985) return { color: 0x7d8a52 };
    return 0.55 + mass * 0.7 + grain * 0.2;
  }
  if (kind === 'sand') {
    // Broad wind-packed patches with low, wandering ripple crests.
    // Integer wave counts and periodic noise keep the pattern tileable.
    const bank = valueNoise(x, y, size, 4, 5) - 0.5;
    const bend = valueNoise(x, y, size, 3, 87) - 0.5;
    const phase = (x + 6 * y) * Math.PI * 2 / size + bend * 2.2;
    const ripple = Math.sin(phase) * 0.13 + Math.sin(phase * 2) * 0.035;
    const sediment = valueNoise(x, y, size, 11, 89) - 0.5;
    return 0.57 + bank * 0.32 + ripple + sediment * 0.12 + grain * 0.06;
  }
  if (kind === 'ashland') {
    // Broad weathered lava plates, muted mineral seams and sparse warm
    // cinders. All large fields are periodic; keep the existing palette,
    // tiny atlas and static material rather than adding an emissive layer.
    const plates = valueNoise(x, y, size, 4, 91) - 0.5;
    const mineral = valueNoise(x, y, size, 13, 93) - 0.5;
    const fracture = valueNoise(x, y, size, 7, 95);
    const fissure = 1 - Math.min(1, Math.abs(fracture - 0.5) / 0.085);
    const cinder = hash(x, y, 19);
    if (cinder > 0.997 && plates < 0.08) return { color: 0xd8641e };
    return 0.54 + plates * 0.48 + mineral * 0.22
      - fissure * fissure * 0.29 + grain * 0.09;
  }
  if (kind === 'snow') {
    const drift = valueNoise(x, y, size, 4, 5) - 0.5;
    const ripple = valueNoise(x, y, size, 9, 6) - 0.5;
    return 0.55 + drift * 0.5 + ripple * 0.3 + grain * 0.14;
  }
  if (kind === 'masonry' || kind === 'roof' || kind === 'cobble') {
    let cellX;
    let cellY;
    let lx;
    let ly;
    let w;
    let h;
    if (kind === 'cobble') {
      // Jittered 8-px cobbles with rounded corners.
      w = 8; h = 8;
      const row = Math.floor(y / h);
      const off = (row % 2) * 4;
      cellX = Math.floor((x + off) / w); cellY = row;
      lx = (x + off) % w; ly = y % h;
      const corner = (lx === 0 || lx === w - 1) && (ly === 0 || ly === h - 1);
      if (lx === 0 || ly === 0 || corner) return SEAM;
    } else {
      h = kind === 'roof' ? 8 : 16;
      const row = Math.floor(y / h);
      const widths = kind === 'roof' ? [8, 8] : [32, 24, 32, 16];
      w = widths[row % widths.length];
      const off = kind === 'roof' ? (row % 2) * 4 : (row % 2) * 12;
      cellX = Math.floor((x + off) / w); cellY = row;
      lx = (x + off) % w; ly = y % h;
      if (ly === 0 || lx === 0) return SEAM;
    }
    const stone = hash(cellX, cellY, kind === 'roof' ? 31 : 37);
    // Pixel-art bevel: lit top/left rim, shadowed bottom/right rim.
    let bevel = 0;
    if (ly === 1 || lx === 1) bevel = 0.22;
    if (ly === h - 1 || lx === w - 1) bevel = -0.24;
    const pit = hash(x, y, 41) > 0.93 ? -0.18 : 0;
    return 0.5 + (stone - 0.5) * 0.45 + bevel + pit + grain * 0.12;
  }
  if (kind === 'stucco') {
    const wash = valueNoise(x, y, size, 4, 5) - 0.5;
    const crack = hash(Math.floor(x / 2), y, 7) > 0.985 || hash(x, Math.floor(y / 3), 8) > 0.99;
    if (crack) return 0.05;
    return 0.6 + wash * 0.5 + grain * 0.2;
  }
  if (kind === 'timber') {
    // Horizontal planks 8 px tall with dark seams, grain streaks and knots.
    const plank = Math.floor(y / 8);
    const ly = y % 8;
    if (ly === 0) return SEAM;
    const streak = Math.sin((x + hash(plank, 0, 11) * 32) * 0.45 + ly * 0.9) * 0.18;
    const knot = hash(Math.floor(x / 5), plank, 13) > 0.94 && ly > 2 && ly < 6 ? -0.35 : 0;
    return 0.55 + (hash(plank, 1, 12) - 0.5) * 0.3 + streak + knot + grain * 0.1;
  }
  if (kind === 'woodlandbark') {
    // Periodic ridges with gently wandering, broken fissures. All broad
    // fields are tileable; grain is restrained so it doesn't read as noise.
    const bend = (valueNoise(x, y, size, 3, 61) - 0.5) * 1.8;
    const phase = 2 * Math.PI * 7 * x / size + bend;
    const ridge = 0.5 + 0.5 * Math.sin(phase);
    const plate = valueNoise(x, y, size, 5, 63);
    const fissure = Math.pow(1 - ridge, 6) * (0.25 + 0.75 * plate);
    const flake = valueNoise(x, y, size, 12, 65);
    return 0.54 + ridge * 0.32 - fissure * 0.40
      + (plate - 0.5) * 0.16 + (flake - 0.5) * 0.08 + grain * 0.04;
  }
  if (kind === 'bark') {
    const ridge = Math.sin(x * 1.3 + valueNoise(x, y, size, 4, 21) * 5) * 0.32;
    return 0.48 + ridge + grain * 0.18;
  }
  // leaves: clumped needles with dark gaps.
  const clump = valueNoise(x, y, size, 8, 23) - 0.5;
  const needle = hash(x, Math.floor(y / 2), 25) - 0.5;
  return 0.5 + clump * 0.9 + needle * 0.35;
}

const cache = new Map();

export function chroniclesPixelTexture(kind) {
  if (!RAMPS[kind]) throw new Error('Unsupported pixel texture: ' + kind);
  if (cache.has(kind)) return cache.get(kind);
  const size = SIZES[kind];
  const ramp = RAMPS[kind];
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = sample(kind, x, y, size);
      let rgb;
      if (value === SEAM) {
        rgb = ramp[0];
      } else if (typeof value === 'object') {
        rgb = hex(value.color);
      } else {
        const dithered = value + BAYER4[(y % 4) * 4 + (x % 4)] / (ramp.length - 1);
        const index = Math.max(0, Math.min(ramp.length - 1, Math.round(dithered * (ramp.length - 1))));
        rgb = ramp[index];
      }
      const offset = (y * size + x) * 4;
      pixels[offset] = rgb[0];
      pixels[offset + 1] = rgb[1];
      pixels[offset + 2] = rgb[2];
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = 'chronicles-pixel-' + kind;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // Up close every texel is a crisp square; far away mipmaps keep it calm.
  const softTerrain = kind === 'meadow' || kind === 'terrafield'
    || kind === 'woodlandpath' || kind === 'uplandrock' || kind === 'marshpeat' || kind === 'ashpath';
  texture.magFilter = softTerrain ? THREE.LinearFilter : THREE.NearestFilter;
  texture.minFilter = softTerrain
    ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
  if (softTerrain) texture.anisotropy = 4; // Calm grazing-angle soil and meadow.
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.userData.chroniclesPixelArt = { kind, size, palette: ramp.length };
  cache.set(kind, texture);
  return texture;
}
