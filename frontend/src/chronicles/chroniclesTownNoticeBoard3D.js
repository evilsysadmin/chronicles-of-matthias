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
            const py = top + ry * scale + dy;
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

// Built entirely from lightweight, authored geometry. The interaction stays
// on its map cell; the model is visual-only and creates no new collision mask.
export function buildChroniclesTownNoticeBoard(root) {
  const board = new THREE.Group();
  board.name = 'chronicles-town-notice-board';
  board.userData.chroniclesDecorativeOnly = true;
  const wood = new THREE.MeshStandardMaterial({ color: 0x68422a, roughness: 0.95 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x302116, roughness: 0.96 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xaa8347, metalness: 0.5, roughness: 0.48 });
  const parchment = new THREE.MeshStandardMaterial({ color: 0xe3cba0, roughness: 1, side: THREE.DoubleSide });
  const ink = new THREE.MeshStandardMaterial({ color: 0x66523a, roughness: 1 });
  const wax = new THREE.MeshStandardMaterial({ color: 0x9b3425, roughness: 0.7 });

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

  // Short overhanging slate roof: two pitched halves, not a flat kiosk lid.
  for (const direction of [-1, 1]) {
    const roof = part('notice-board-roof',
      new THREE.BoxGeometry(1.47, 0.11, 0.65), edge, direction * 0.71, 3.05, 0.06);
    roof.rotation.z = -direction * 0.19;
  }
  part('notice-board-header', new THREE.BoxGeometry(2.55, 0.5, 0.17),
    edge, 0, 2.70, 0.14);
  const title = part('notice-board-lettering',
    new THREE.PlaneGeometry(2.32, 0.44),
    new THREE.MeshBasicMaterial({ map: engravedTitle(), toneMapped: false, side: THREE.DoubleSide }),
    0, 2.70, 0.235);
  title.userData.noticeBoardTitle = 'EDICTOS Y ENCARGOS';

  // Three mismatched writs: nails, ruled ink and wax make the purpose obvious
  // from a few metres away without tiny unreadable runtime text.
  [-0.74, 0, 0.74].forEach((x, index) => {
    const height = [0.93, 1.08, 0.84][index];
    const top = 2.27;
    const centerY = top - height / 2;
    const paper = part('notice-board-parchment',
      new THREE.PlaneGeometry(0.61, height),
      parchment, x, centerY, 0.155);
    paper.rotation.z = [-0.045, 0.025, -0.022][index];
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
    const seal = part('notice-board-wax-seal',
      new THREE.CircleGeometry(0.088, 12), wax,
      x + 0.16, centerY - height * 0.31, 0.171);
    seal.rotation.z = 0.2 * (index - 1);
  });
  root.add(board);
  return board;
}
