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

// Scene-persistent, low-poly geometry (no image downloads or per-frame meshes).
// Silhouettes are intentionally exaggerated just enough to read at speed.
export function createChroniclesVolleyProjectileArt(THREE, camera, worldScene = null) {
  const group = new THREE.Group();
  group.name = 'chronicles-party-projectile-volley';
  group.visible = false;

  const material = (color, options = {}) => new THREE.MeshBasicMaterial({
    // Let scenery occlude real shafts, instead of painting luminous HUD diamonds.
    color, depthTest: true, depthWrite: false, ...options,
  });
  const wood = material(0x90683d);
  const polishedWood = material(0xb58f5f);
  const brightSteel = material(0xabb9ba);
  const steelShadow = material(0x586a73);
  const darkSteel = material(0x53616a);
  const paleFeathers = material(0x93856f, { side: THREE.DoubleSide });
  const darkFeathers = material(0x756b5b, { side: THREE.DoubleSide });
  const stoneMaterial = material(0x91938c);
  const stoneHighlight = material(0xb4b1a6);
  // The flight streak is air displacement, not a glowing bolt of magic.
  const bowTrail = material(0xb79c77, { transparent: true, opacity: 0.10 });
  const boltTrail = material(0x98a8b0, { transparent: true, opacity: 0.09 });
  const slingTrail = material(0xaaa394, { transparent: true, opacity: 0.07 });

  const arrowShaft = new THREE.CylinderGeometry(0.016, 0.017, 0.74, 8);
  const shaftCore = new THREE.CylinderGeometry(0.019, 0.019, 0.66, 8);
  const arrowHead = new THREE.ConeGeometry(0.034, 0.12, 5);
  const boltShaft = new THREE.CylinderGeometry(0.029, 0.027, 0.42, 8);
  const boltHead = new THREE.ConeGeometry(0.043, 0.14, 4);
  const bolster = new THREE.CylinderGeometry(0.037, 0.037, 0.065, 8);
  // Slim quill silhouette: length follows the shaft, width rises only a
  // little above it. The previous broad vanes filled the screen like stars.
  const featherShape = new THREE.Shape();
  featherShape.moveTo(-0.11, 0.006);
  featherShape.lineTo(-0.065, 0.024);
  featherShape.lineTo(0.070, 0.020);
  featherShape.lineTo(0.10, 0.006);
  featherShape.lineTo(0.065, 0.006);
  featherShape.closePath();
  const featherGeometry = new THREE.ShapeGeometry(featherShape);

  // Slightly asymmetric flint; still one shared faceted geometry.
  const stoneGeometry = new THREE.IcosahedronGeometry(0.105, 0);
  stoneGeometry.scale(1.11, 0.91, 1.04);
  const stoneGlint = new THREE.TetrahedronGeometry(0.047, 0);
  const bowTrailGeometry = new THREE.ConeGeometry(0.009, 0.44, 3);
  const boltTrailGeometry = new THREE.ConeGeometry(0.011, 0.36, 3);
  const stoneTrailGeometry = new THREE.ConeGeometry(0.018, 0.28, 4);

  function part(geometry, surface, name) {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.name = name;
    mesh.renderOrder = 21;
    mesh.frustumCulled = false;
    return mesh;
  }

  function noseForward(mesh) {
    // Cylinders/cones are born along +Y. The shots fly toward camera -Z.
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function flightRod(kind, { shaftGeometry, headGeometry, shaftSurface,
    headSurface, finSurface, tip, tail, finSize, trailGeometry, trailSurface }) {
    const variant = new THREE.Group();
    variant.name = 'chronicles-volley-' + kind;
    const shaft = noseForward(part(shaftGeometry, shaftSurface, kind + '-shaft'));
    const head = noseForward(part(headGeometry, headSurface, kind + '-head'));
    head.position.z = tip;
    variant.add(shaft, head);

    if (kind === 'bow') {
      const grain = noseForward(part(shaftCore, polishedWood, 'bow-grain'));
      grain.scale.set(0.37, 0.74, 0.37);
      variant.add(grain);
    } else {
      const collar = noseForward(part(bolster, steelShadow, 'crossbow-collar'));
      collar.position.z = -0.09;
      variant.add(collar);
    }

    for (let fin = 0; fin < 3; fin += 1) {
      const featherMount = new THREE.Group();
      featherMount.name = kind + '-fletching-mount-' + fin;
      featherMount.position.z = tail;
      // Rotate the already shaft-aligned vane around the actual flight axis.
      // Putting Z in a single XYZ Euler first turned the long vane diagonally
      // away from the shaft and made the three fins look like a giant star.
      featherMount.rotation.z = fin * Math.PI * 2 / 3;
      const feather = part(featherGeometry, finSurface, kind + '-fletching-' + fin);
      feather.rotation.y = Math.PI / 2;
      feather.scale.setScalar(finSize);
      featherMount.add(feather);
      variant.add(featherMount);
    }
    const trail = part(trailGeometry, trailSurface, kind + '-trail');
    // A short, almost transparent motion smear immediately behind the nock.
    trail.rotation.x = Math.PI / 2;
    trail.position.z = tail + (kind === 'bow' ? 0.22 : 0.18);
    variant.add(trail);
    return variant;
  }

  const projectiles = Array.from({ length: 6 }, (_, index) => {
    const root = new THREE.Group();
    root.name = 'chronicles-volley-projectile-' + (index + 1);
    const bow = flightRod('bow', {
      shaftGeometry: arrowShaft, headGeometry: arrowHead,
      shaftSurface: wood, headSurface: brightSteel, finSurface: paleFeathers,
      tip: -0.425, tail: 0.29, finSize: 0.86, trailGeometry: bowTrailGeometry, trailSurface: bowTrail,
    });
    const crossbow = flightRod('crossbow', {
      shaftGeometry: boltShaft, headGeometry: boltHead,
      shaftSurface: darkSteel, headSurface: brightSteel, finSurface: darkFeathers,
      tip: -0.268, tail: 0.165, finSize: 0.58,
      trailGeometry: boltTrailGeometry, trailSurface: boltTrail,
    });
    const sling = new THREE.Group();
    sling.name = 'chronicles-volley-sling';
    sling.add(part(stoneGeometry, stoneMaterial, 'sling-stone'));
    const glint = part(stoneGlint, stoneHighlight, 'sling-facet');
    glint.position.set(0.03, 0.058, -0.052);
    sling.add(glint);
    const dust = part(stoneTrailGeometry, slingTrail, 'sling-trail');
    dust.rotation.x = Math.PI / 2;
    dust.position.z = 0.20;
    sling.add(dust);
    root.add(bow, crossbow, sling);
    root.userData.volleyVariants = { bow, crossbow, sling };
    root.userData.volleyKind = null;
    root.visible = false;
    group.add(root);
    return root;
  });
  // The scene-mounted variant freezes the launch transform. Keeping this
  // group on the camera would bend an arrow whenever camera yaw easing catches
  // up with a turn completed immediately before firing.
  (worldScene || camera).add(group);

  function anchorLaunchPose(logicalYaw = null) {
    if (!worldScene) return;
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(group.position);
    camera.getWorldQuaternion(group.quaternion);
    // Camera yaw eases toward the party's actual facing. A shot made just
    // after turning must follow the logical facing, not the old eased yaw.
    if (Number.isFinite(logicalYaw)) {
      const correction = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), logicalYaw - camera.rotation.y,
      );
      group.quaternion.premultiply(correction);
    }
  }

  function setFamilies(families) {
    const valid = (Array.isArray(families) ? families : [])
      .filter((kind) => CHRONICLES_VOLLEY_FAMILIES.includes(kind)).slice(0, projectiles.length);
    projectiles.forEach((root, index) => {
      const kind = valid[index] || null;
      root.userData.volleyKind = kind;
      root.visible = kind !== null;
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(1);
      Object.entries(root.userData.volleyVariants).forEach(([name, variant]) => {
        variant.visible = name === kind;
      });
    });
    group.visible = valid.length > 0;
    return valid.length;
  }

  return { group, projectiles, setFamilies, anchorLaunchPose };
}
