// Deterministic, self-contained surface detail for Swordhaven facades and roads.
// Keep the classic pixel atlas for the overworld; these close-up town surfaces
// need finer mortar, weathering and grain. Shared DataTextures: no downloads.
export const CHRONICLES_TOWN_SURFACE_KINDS = Object.freeze(['stucco', 'masonry', 'roof', 'timber', 'cobble']);

const SURFACES = Object.freeze({
  stucco: { size: 128, base: [240, 231, 215] },
  masonry: { size: 256, base: [221, 215, 204], width: 64, height: 32 },
  roof: { size: 128, base: [205, 195, 184], width: 32, height: 16 },
  timber: { size: 128, base: [206, 179, 151] },
  cobble: { size: 256, base: [217, 211, 197], width: 32, height: 16 },
});

function hash(x, y, salt = 0) {
  let h = Math.imul(x + 374761393 + salt * 668265263, 0x27d4eb2d)
    ^ Math.imul(y + 668265263, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function noise(x, y, size, cells, salt) {
  const u = x * cells / size;
  const v = y * cells / size;
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = (u - ix) ** 2 * (3 - 2 * (u - ix));
  const fy = (v - iy) ** 2 * (3 - 2 * (v - iy));
  const h = (dx, dy) => hash((ix + dx) % cells, (iy + dy) % cells, salt);
  return (h(0, 0) * (1 - fx) + h(1, 0) * fx) * (1 - fy)
    + (h(0, 1) * (1 - fx) + h(1, 1) * fx) * fy;
}

function surfaceDetail(kind, x, y, spec) {
  const { size } = spec;
  const grain = hash(x, y, 13) - 0.5;
  const erosion = noise(x, y, size, 8, 17) - 0.5;
  const fine = noise(x, y, size, 32, 19) - 0.5;
  if (kind === 'stucco') {
    const speck = hash(x, y, 7);
    return { shade: 1 + erosion * 0.16 + fine * 0.10 + grain * 0.09
      - (speck > 0.991 ? 0.22 : 0), mortar: false };
  }
  if (kind === 'timber') {
    const board = Math.floor(x / 24);
    const edge = x % 24;
    const grainLine = Math.sin(x * 0.46 + noise(x, y, size, 8, 29) * 7) * 0.07;
    const knot = hash(Math.floor(x / 7), Math.floor(y / 11), 23) > 0.98 ? -0.18 : 0;
    return { shade: 0.96 + (hash(board, 0, 31) - 0.5) * 0.24
      + erosion * 0.10 + grainLine + grain * 0.07 + knot,
    mortar: edge < 2 };
  }

  // Staggered ashlar, slate and irregular cobbles. Rows and half-row shifts
  // divide the power-of-two texture exactly, including at wrapped UV seams.
  const { width, height } = spec;
  const row = Math.floor(y / height);
  const shifted = (x + (row % 2) * width / 2) % size;
  const column = Math.floor(shifted / width);
  const lx = shifted % width;
  const ly = y % height;
  const wobble = kind === 'cobble'
    ? Math.sin(ly * 0.72 + row * 1.3) * 0.85 : 0;
  const edge = (kind === 'cobble' ? 2.5 : 1.8) + wobble;
  const mortar = lx < edge || ly < (kind === 'cobble' ? 2.0 : 1.8);
  const bevel = (lx < 5 || ly < 5 ? 0.12 : 0)
    - (lx > width - 6 || ly > height - 6 ? 0.15 : 0);
  const stone = hash(column, row, kind === 'cobble' ? 41 : kind === 'roof' ? 43 : 47);
  return { shade: 1 + (stone - 0.5) * 0.30 + erosion * 0.24
    + fine * 0.14 + grain * 0.11 + bevel, mortar };
}

const byte = value => Math.max(0, Math.min(255, Math.round(value)));

export function chroniclesTownSurfacePixels(kind) {
  const spec = SURFACES[kind];
  if (!spec) throw new Error('Unsupported Swordhaven material: ' + kind);
  const { size, base } = spec;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const detail = surfaceDetail(kind, x, y, spec);
      const moss = kind === 'cobble' && detail.mortar
        && noise(x, y, size, 16, 53) > 0.68;
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const pigment = detail.mortar
          ? (kind === 'timber' ? [61, 46, 34] : moss ? [75, 95, 50] : [91, 85, 76])[channel]
          : base[channel] * detail.shade;
        pixels[offset + channel] = byte(pigment);
      }
      pixels[offset + 3] = 255;
    }
  }
  return { size, pixels };
}
