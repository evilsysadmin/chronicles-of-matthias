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
    color, depthTest: false, depthWrite: false, ...options,
  });
  const wood = material(0xa97842);
  const polishedWood = material(0xe7b97a);
  const brightSteel = material(0xe6eef0);
  const steelShadow = material(0x667b86);
  const darkSteel = material(0x53616a);
  const paleFeathers = material(0xe9d9b9, { side: THREE.DoubleSide });
  const darkFeathers = material(0x9a8770, { side: THREE.DoubleSide });
  const stoneMaterial = material(0xa6a69e);
  const stoneHighlight = material(0xd1cbb9);
  const bowTrail = material(0xcfa66d, { transparent: true, opacity: 0.20,
    blending: THREE.AdditiveBlending });
  const boltTrail = material(0xb8cbd5, { transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending });
  const slingTrail = material(0xbcb4a1, { transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending });

  const arrowShaft = new THREE.CylinderGeometry(0.016, 0.017, 0.74, 8);
  const shaftCore = new THREE.CylinderGeometry(0.019, 0.019, 0.66, 8);
  const arrowHead = new THREE.ConeGeometry(0.052, 0.14, 5);
  const boltShaft = new THREE.CylinderGeometry(0.029, 0.027, 0.42, 8);
  const boltHead = new THREE.ConeGeometry(0.066, 0.16, 4);
  const bolster = new THREE.CylinderGeometry(0.037, 0.037, 0.065, 8);
  // A stylised triangular feather, rather than a rectangular stick-on box.
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, -0.115);
  featherShape.lineTo(0.085, -0.058);
  featherShape.lineTo(0.105, 0.068);
  featherShape.lineTo(0.018, 0.105);
  featherShape.closePath();
  const featherGeometry = new THREE.ShapeGeometry(featherShape);

  // Slightly asymmetric flint; still one shared faceted geometry.
  const stoneGeometry = new THREE.IcosahedronGeometry(0.105, 0);
  stoneGeometry.scale(1.11, 0.91, 1.04);
  const stoneGlint = new THREE.TetrahedronGeometry(0.047, 0);
  const bowTrailGeometry = new THREE.ConeGeometry(0.026, 0.68, 5);
  const boltTrailGeometry = new THREE.ConeGeometry(0.034, 0.59, 5);
  const stoneTrailGeometry = new THREE.ConeGeometry(0.043, 0.35, 5);

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
      const feather = part(featherGeometry, finSurface, kind + '-fletching-' + fin);
      feather.rotation.set(Math.PI / 2, 0, fin * Math.PI * 2 / 3);
      feather.scale.setScalar(finSize);
      feather.position.z = tail;
      variant.add(feather);
    }
    const trail = part(trailGeometry, trailSurface, kind + '-trail');
    // A very thin, low-opacity taper behind the tail, not a glowing laser.
    trail.rotation.x = Math.PI / 2;
    trail.position.z = tail + (kind === 'bow' ? 0.31 : 0.26);
    variant.add(trail);
    return variant;
  }

  const projectiles = Array.from({ length: 6 }, (_, index) => {
    const root = new THREE.Group();
    root.name = 'chronicles-volley-projectile-' + (index + 1);
    const bow = flightRod('bow', {
      shaftGeometry: arrowShaft, headGeometry: arrowHead,
      shaftSurface: wood, headSurface: brightSteel, finSurface: paleFeathers,
      tip: -0.425, tail: 0.29, finSize: 1, trailGeometry: bowTrailGeometry, trailSurface: bowTrail,
    });
    const crossbow = flightRod('crossbow', {
      shaftGeometry: boltShaft, headGeometry: boltHead,
      shaftSurface: darkSteel, headSurface: brightSteel, finSurface: darkFeathers,
      tip: -0.268, tail: 0.165, finSize: 0.68,
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
    dust.position.z = 0.28;
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
