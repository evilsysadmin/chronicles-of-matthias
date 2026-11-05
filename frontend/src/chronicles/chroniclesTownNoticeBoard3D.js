import * as THREE from 'three';

// Small local bitmap alphabet: no font download, canvas dependency or asset in Git.
const GLYPHS = Object.freeze({
  A: [14,17,17,31,17,17,17], C: [15,16,16,16,16,16,15],
  D: [30,17,17,17,17,17,30], E: [31,16,16,30,16,16,31],
  G: [15,16,16,23,17,17,15], I: [31,4,4,4,4,4,31],
  N: [17,25,21,19,17,17,17], O: [14,17,17,17,17,17,14],
  R: [30,17,17,30,20,18,17], S: [15,16,16,14,1,1,30],
  T: [31,4,4,4,4,4,4], Y: [17,17,10,4,4,4,4],
});
let titleTexture;

function engravedTitle() {
  if (titleTexture) return titleTexture;
  const width = 256, height = 64;
  const pixels = new Uint8Array(width * height * 4);
  const lines = ['EDICTOS', 'ENCARGOS'];
  // Two lines on a carved timber header: cream lettering on dark wood.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      pixels.set([47, 30, 19, 255], i);
    }
  }
  const scale = 3;
  lines.forEach((line, rowIndex) => {
    const start = Math.floor((width - (line.length * 6 - 1) * scale) / 2);
    const top = rowIndex === 0 ? 5 : 35;
    [...line].forEach((letter, index) => {
      (GLYPHS[letter] || []).forEach((bits, ry) => {
        for (let cx = 0; cx < 5; cx += 1) {
          if (!(bits & (1 << (4 - cx)))) continue;
          for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
            const px = start + (index * 6 + cx) * scale + dx;
            // DataTexture rows begin at the bottom; keep glyphs and titles upright.
            const py = height - 1 - (top + ry * scale + dy);
            const i = (py * width + px) * 4;
            pixels.set([244, 213, 151, 255], i);
          }
        }
      });
    });
  });
  titleTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  titleTexture.colorSpace = THREE.SRGBColorSpace;
  titleTexture.magFilter = THREE.NearestFilter;
  titleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  titleTexture.generateMipmaps = true;
  titleTexture.needsUpdate = true;
  return titleTexture;
}

// Small deterministic DataTextures: no new network requests or DOM canvas.
// Wood fibers and aged-paper speckle stay crisp in the first-person scene.
function noticeBoardSurface(kind) {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const grain = Math.sin(y * .63 + Math.sin(x * .20) * 1.6) * 9
      + Math.sin(y * 1.71 + x * .09) * 4;
    const speckle = ((x * 29 + y * 47 + x * y * 3) % 17) - 8;
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
    const wear = kind === 'paper' ? Math.max(0, 7 - edge) * 3 : 0;
    const l = kind === 'paper' ? speckle * .72 - wear : grain + speckle * .6;
    const c = kind === 'paper'
      ? [238 + l, 209 + l * .85, 157 + l * .56]
      : [90 + l, 54 + l * .62, 32 + l * .5];
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k += 1) pixels[i + k] = Math.max(0, Math.min(255, Math.round(c[k])));
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// Uneven, slightly torn edges are geometry, never a flat rectangle.
function tornWritGeometry(width, height, offset = 0) {
  const sx = width / 2;
  const sy = height / 2;
  const d = 0.018;
  const points = [
    [-sx + d, -sy + d], [-sx * .72, -sy + d / 3], [-sx * .28, -sy - d / 2],
    [sx * .19, -sy + d], [sx * .65, -sy - d / 3], [sx - d, -sy + d],
    [sx + d / 4, -sy * .66], [sx - d / 2, -sy * .2], [sx, sy * .3],
    [sx - d, sy - d], [sx * .59, sy + d / 3], [sx * .06, sy - d / 2],
    [-sx * .47, sy + d / 3], [-sx + d, sy - d],
    [-sx - d / 3, sy * .42], [-sx + d / 2, -sy * .08],
  ];
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const px = x + (i % 4 === 0 ? offset * .004 : 0);
    if (i === 0) shape.moveTo(px, y);
    else shape.lineTo(px, y);
  });
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  // ShapeGeometry defaults to world-space UVs. Normalize to the whole writ
  // so paper grain is actually sampled across its surface, not at the edge.
  const coords = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let i = 0; i < uvs.count; i += 1) {
    uvs.setXY(i,
      THREE.MathUtils.clamp(coords.getX(i) / width + 0.5, 0, 1),
      THREE.MathUtils.clamp(coords.getY(i) / height + 0.5, 0, 1));
  }
  uvs.needsUpdate = true;
  return geometry;
}

// Built entirely from lightweight, authored geometry. The interaction stays
// on its map cell; the model is visual-only and creates no new collision mask.
export function buildChroniclesTownNoticeBoard(root) {
  const board = new THREE.Group();
  board.name = 'chronicles-town-notice-board';
  board.userData.chroniclesDecorativeOnly = true;
  const wood = new THREE.MeshStandardMaterial({ map: noticeBoardSurface('wood'), roughness: 0.93 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x302016, roughness: 0.98 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x38332e, metalness: 0.59, roughness: 0.61 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc39a60, metalness: 0.54, roughness: 0.42 });
  const parchment = new THREE.MeshStandardMaterial({
    map: noticeBoardSurface('paper'), roughness: 1, side: THREE.DoubleSide,
  });
  const ink = new THREE.MeshStandardMaterial({ color: 0x6a492e, roughness: 1 });
  const wax = new THREE.MeshStandardMaterial({ color: 0x922b22, roughness: 0.65 });
  const amberWax = new THREE.MeshStandardMaterial({ color: 0xa5792c, roughness: 0.65 });

  function part(name, geometry, mat, x, y, z) {
    const m = new THREE.Mesh(geometry, mat);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = false; // Low draw/lighting cost for the decorative town prop.
    m.receiveShadow = true;
    board.add(m);
    return m;
  }

  for (const x of [-1.12, 1.12]) {
    part('notice-board-post', new THREE.BoxGeometry(0.16, 2.91, 0.18), wood, x, 1.455, 0);
    part('notice-board-post-cap', new THREE.BoxGeometry(0.24, 0.15, 0.25), edge, x, 2.91, 0);
  }
  part('notice-board-back', new THREE.BoxGeometry(2.45, 1.63, 0.15), edge, 0, 1.81, 0);
  for (let i = 0; i < 6; i += 1) {
    part('notice-board-plank', new THREE.BoxGeometry(2.22, 0.245, 0.035),
      wood, 0, 1.14 + i * 0.27, 0.092);
  }
  for (const x of [-1.24, 1.24]) {
    part('notice-board-side-frame', new THREE.BoxGeometry(0.11, 1.8, 0.22), wood, x, 1.81, 0.13);
  }
  part('notice-board-bottom-frame', new THREE.BoxGeometry(2.60, 0.12, 0.24),
    wood, 0, 0.88, 0.13);
  // Forged-iron reinforcement follows the actual timber; purely decorative.
  for (const x of [-1.22, 1.22]) {
    part('notice-board-iron-strap', new THREE.BoxGeometry(0.07, 1.67, 0.038),
      iron, x, 1.82, 0.262);
    for (const y of [1.08, 2.49]) {
      const rivet = part('notice-board-rivet',
        new THREE.SphereGeometry(0.042, 8, 5), brass, x, y, 0.294);
      rivet.scale.z = 0.35;
    }
  }
  for (const x of [-1.06, 1.06]) {
    part('notice-board-cross-brace',
      new THREE.BoxGeometry(0.30, 0.065, 0.032), iron, x, 2.42, 0.258).rotation.z = x > 0 ? -0.55 : 0.55;
  }

  // Short overhanging slate roof: two pitched halves, not a flat kiosk lid.
  for (const direction of [-1, 1]) {
    const roof = part('notice-board-roof',
      new THREE.BoxGeometry(1.47, 0.11, 0.65), edge, direction * 0.71, 3.05, 0.06);
    roof.rotation.z = -direction * 0.19;
  }
  part('notice-board-header', new THREE.BoxGeometry(2.55, 0.5, 0.17),
    edge, 0, 2.70, 0.14);
  part('notice-board-header-brass-inlay', new THREE.BoxGeometry(2.39, 0.45, 0.024),
    brass, 0, 2.70, 0.237);
  const title = part('notice-board-lettering',
    new THREE.PlaneGeometry(2.31, 0.41),
    new THREE.MeshBasicMaterial({ map: engravedTitle(), toneMapped: false, side: THREE.DoubleSide }),
    0, 2.70, 0.253);
  // A small heraldic shield crowns the noticeboard, echoing the guild folio.
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.15, 0.12);
  shieldShape.lineTo(0.15, 0.12);
  shieldShape.lineTo(0.15, -0.04);
  shieldShape.lineTo(0, -0.19);
  shieldShape.lineTo(-0.15, -0.04);
  shieldShape.closePath();
  const shield = part('notice-board-heraldic-crest',
    new THREE.ShapeGeometry(shieldShape),
    new THREE.MeshStandardMaterial({
      color: 0x7a2f29, metalness: 0.3, roughness: 0.58, side: THREE.DoubleSide,
    }), 0, 3.01, 0.416);
  shield.rotation.z = 0;
  part('notice-board-crest-glyph', new THREE.OctahedronGeometry(0.07, 0),
    brass, 0, 3.04, 0.43);
  title.userData.noticeBoardTitle = 'EDICTOS Y ENCARGOS';

  // Three mismatched writs: nails, ruled ink and wax make the purpose obvious
  // from a few metres away without tiny unreadable runtime text.
  [-0.74, 0, 0.74].forEach((x, index) => {
    const height = [0.93, 1.08, 0.84][index];
    const top = 2.27;
    const centerY = top - height / 2;
    const paperGeometry = tornWritGeometry(0.61, height, index);
    const paperShadow = part('notice-board-paper-shadow', paperGeometry.clone(),
      edge, x + 0.018, centerY - 0.018, 0.147);
    const paper = part('notice-board-parchment',
      paperGeometry, parchment, x, centerY, 0.155);
    paper.rotation.z = [-0.045, 0.025, -0.022][index];
    paperShadow.rotation.z = paper.rotation.z;
    const nail = part('notice-board-nail',
      new THREE.SphereGeometry(0.047, 6, 4), brass, x, top - 0.08, 0.20);
    nail.scale.z = 0.4;
    const lineCount = index === 1 ? 5 : 4;
    for (let n = 0; n < lineCount; n += 1) {
      const length = (n % 3 === 2 ? 0.29 : 0.42);
      part('notice-board-ink-line',
        new THREE.BoxGeometry(length, 0.018, 0.004),
        ink, x - (0.42 - length) / 2, top - 0.24 - n * 0.115, 0.163);
    }
    // Ribbon tails and two wax hues read clearly at mid-distance.
    for (const shift of [-0.028, 0.028]) {
      const ribbon = part('notice-board-seal-ribbon',
        new THREE.BoxGeometry(0.034, 0.16, 0.006),
        index === 1 ? amberWax : wax,
        x + 0.16 + shift, centerY - height * 0.31 - 0.07, 0.173);
      ribbon.rotation.z = shift > 0 ? -.18 : .18;
    }
    const seal = part('notice-board-wax-seal',
      new THREE.CircleGeometry(0.095, 12), index === 1 ? amberWax : wax,
      x + 0.16, centerY - height * 0.31, 0.178);
    seal.rotation.z = 0.2 * (index - 1);
    part('notice-board-seal-imprint',
      new THREE.OctahedronGeometry(0.039, 0),
      brass, x + 0.16, centerY - height * 0.31, 0.182);
  });
  root.add(board);
  return board;
}
