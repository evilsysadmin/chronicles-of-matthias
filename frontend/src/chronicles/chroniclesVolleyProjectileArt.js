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
  // Matte, contrast-controlled metal and quills. BasicMaterial's previous
  // pale steel rendered as a conspicuous white square from behind the arrow.
  const wood = material(0x755333);
  const polishedWood = material(0x95714b);
  const brightSteel = material(0x677477);
  const steelShadow = material(0x414d4e);
  const darkSteel = material(0x515554);
  const paleFeathers = material(0xa29377, { side: THREE.DoubleSide });
  const darkFeathers = material(0x72634f, { side: THREE.DoubleSide });
  const stoneMaterial = material(0x91938c);
  const stoneHighlight = material(0xb4b1a6);
  // The flight streak is air displacement, not a glowing bolt of magic.
  const bowTrail = material(0xb79c77, { transparent: true, opacity: 0.10 });
  const boltTrail = material(0x98a8b0, { transparent: true, opacity: 0.09 });
  const slingTrail = material(0xaaa394, { transparent: true, opacity: 0.07 });

  // Arrowheads should read as *points* from this camera, not white beads
  // glued onto drumsticks. Realistic slender shafts also stay legible up close.
  const arrowShaft = new THREE.CylinderGeometry(0.010, 0.011, 0.82, 6);
  const shaftCore = new THREE.CylinderGeometry(0.014, 0.014, 0.73, 6);
  const arrowHead = new THREE.ConeGeometry(0.019, 0.105, 4);
  const boltShaft = new THREE.CylinderGeometry(0.017, 0.018, 0.48, 6);
  const boltHead = new THREE.ConeGeometry(0.024, 0.115, 4);
  const bolster = new THREE.CylinderGeometry(0.023, 0.023, 0.042, 6);
  // Long, narrow feather flags on the rear third of the shaft. Their
  // distinctive tapered outline is visible from a glancing angle, while
  // their radial reach stays much smaller than the old ninja-star blades.
  const featherShape = new THREE.Shape();
  featherShape.moveTo(-0.145, 0.007);
  featherShape.lineTo(-0.095, 0.027);
  featherShape.lineTo(-0.030, 0.047);
  featherShape.lineTo(0.080, 0.037);
  featherShape.lineTo(0.145, 0.008);
  featherShape.lineTo(0.060, 0.011);
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
      grain.scale.set(0.36, 0.77, 0.36);
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
      tip: -0.438, tail: 0.31, finSize: 0.88, trailGeometry: bowTrailGeometry, trailSurface: bowTrail,
    });
    const crossbow = flightRod('crossbow', {
      shaftGeometry: boltShaft, headGeometry: boltHead,
      shaftSurface: darkSteel, headSurface: brightSteel, finSurface: darkFeathers,
      tip: -0.296, tail: 0.19, finSize: 0.64,
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
