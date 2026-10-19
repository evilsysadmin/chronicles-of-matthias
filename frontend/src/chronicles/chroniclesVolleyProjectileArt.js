import { chroniclesEquippedItem } from './chroniclesEquipment.js';

export const CHRONICLES_VOLLEY_FAMILIES = Object.freeze(['bow', 'crossbow', 'sling']);

// The gameplay reducer decides exactly who fires. This adapter asks the
// class-validated equipment catalog what those real shots look like; it
// never invents an arrow for a dead hero or an incompatible weapon.
export function chroniclesVolleyProjectileKinds(state, shooterIds) {
  const living = new Set((state?.party || [])
    .filter((member) => Number(member?.hp || 0) > 0)
    .map((member) => member.id));
  const seen = new Set();
  return (Array.isArray(shooterIds) ? shooterIds : []).flatMap((memberId) => {
    if (!living.has(memberId) || seen.has(memberId)) return [];
    seen.add(memberId);
    const kind = chroniclesEquippedItem(state, memberId, 'missile')?.weaponFamily;
    return CHRONICLES_VOLLEY_FAMILIES.includes(kind) ? [kind] : [];
  }).slice(0, 6);
}

// Shared, small geometries. Instantiated once per scene, never in the
// requestAnimationFrame loop; no textures, network requests or heavy assets.
export function createChroniclesVolleyProjectileArt(THREE, camera) {
  const group = new THREE.Group();
  group.name = 'chronicles-party-projectile-volley';
  group.visible = false;

  const wood = new THREE.MeshBasicMaterial({ color: 0xd7a065, depthTest: false, depthWrite: false });
  const paleFeathers = new THREE.MeshBasicMaterial({ color: 0xf0dfbf, depthTest: false, depthWrite: false });
  const metal = new THREE.MeshBasicMaterial({ color: 0xc5d0d4, depthTest: false, depthWrite: false });
  const darkMetal = new THREE.MeshBasicMaterial({ color: 0x58636b, depthTest: false, depthWrite: false });
  const boltFeathers = new THREE.MeshBasicMaterial({ color: 0x695a4b, depthTest: false, depthWrite: false });
  const stoneMaterial = new THREE.MeshBasicMaterial({ color: 0x9b9a8c, depthTest: false, depthWrite: false });

  const arrowShaft = new THREE.CylinderGeometry(0.012, 0.012, 0.54, 6);
  const arrowHead = new THREE.ConeGeometry(0.039, 0.105, 6);
  const arrowFletching = new THREE.BoxGeometry(0.135, 0.018, 0.10);
  const boltShaft = new THREE.CylinderGeometry(0.024, 0.022, 0.33, 6);
  const boltHead = new THREE.ConeGeometry(0.054, 0.105, 6);
  const boltFletching = new THREE.BoxGeometry(0.09, 0.027, 0.09);
  const stoneGeometry = new THREE.IcosahedronGeometry(0.095, 0);

  function part(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = 21;
    mesh.frustumCulled = false;
    return mesh;
  }

  function flightRod(kind, shaftGeometry, headGeometry, fletchingGeometry, {
    shaftMaterial, headMaterial, vaneMaterial, tip, tail,
  }) {
    const variant = new THREE.Group();
    variant.name = 'chronicles-volley-' + kind;
    const shaft = part(shaftGeometry, shaftMaterial, kind + '-shaft');
    shaft.rotation.x = Math.PI / 2;
    const head = part(headGeometry, headMaterial, kind + '-head');
    head.rotation.x = -Math.PI / 2;
    head.position.z = tip;
    const feathers = part(fletchingGeometry, vaneMaterial, kind + '-fletching');
    feathers.position.z = tail;
    variant.add(shaft, head, feathers);
    return variant;
  }

  const projectiles = Array.from({ length: 6 }, (_, index) => {
    const root = new THREE.Group();
    root.name = 'chronicles-volley-projectile-' + (index + 1);
    const bow = flightRod('bow', arrowShaft, arrowHead, arrowFletching, {
      shaftMaterial: wood, headMaterial: metal, vaneMaterial: paleFeathers,
      tip: -0.315, tail: 0.29,
    });
    const crossbow = flightRod('crossbow', boltShaft, boltHead, boltFletching, {
      shaftMaterial: darkMetal, headMaterial: metal, vaneMaterial: boltFeathers,
      tip: -0.212, tail: 0.18,
    });
    const sling = new THREE.Group();
    sling.name = 'chronicles-volley-sling';
    sling.add(part(stoneGeometry, stoneMaterial, 'sling-stone'));
    root.add(bow, crossbow, sling);
    root.userData.volleyVariants = { bow, crossbow, sling };
    root.userData.volleyKind = null;
    root.visible = false;
    group.add(root);
    return root;
  });
  camera.add(group);

  function setFamilies(families) {
    const valid = (Array.isArray(families) ? families : [])
      .filter((kind) => CHRONICLES_VOLLEY_FAMILIES.includes(kind)).slice(0, projectiles.length);
    projectiles.forEach((root, index) => {
      const kind = valid[index] || null;
      root.userData.volleyKind = kind;
      root.visible = kind !== null;
      root.rotation.set(0, 0, 0);
      Object.entries(root.userData.volleyVariants).forEach(([name, variant]) => {
        variant.visible = name === kind;
      });
    });
    group.visible = valid.length > 0;
    return valid.length;
  }

  return { group, projectiles, setFamilies };
}
