import * as THREE from 'three';

// Simple, truthful state colours. Exactly half health is already critical.
export function chroniclesEnemyHealthTint(hp, maxHp) {
  const maximum = Number(maxHp);
  const current = Number(hp);
  if (!Number.isFinite(maximum) || maximum <= 0 || !Number.isFinite(current)) return '#f56d69';
  if (current >= maximum) return '#82dda0';
  return current / maximum > 0.5 ? '#f3ce68' : '#f56d69';
}

export function chroniclesEnemyNameplateText(enemy) {
  const name = String(enemy?.name || enemy?.visualType || 'Enemigo').trim();
  return name.length > 29 ? name.slice(0, 28) + '…' : name;
}

// Labels belong to their real enemy objects, never to a UI guess about what
// might be lurking in the camera. The tint updates only when its health band
// changes, not every animation frame. One canvas texture per visible actor.
export function buildChroniclesEnemyNameplate(enemyDefinition, worldHeight = 2.5) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 104;
  let context;
  try { context = canvas.getContext('2d'); } catch { return null; }
  if (!context) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: true, fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'chronicles-enemy-nameplate-' + enemyDefinition.id;
  sprite.scale.set(3.4, 0.59, 1);
  sprite.position.y = Math.max(1.4, Number(worldHeight) || 2.5) + 0.23;
  sprite.renderOrder = 3;
  sprite.visible = false;
  const title = chroniclesEnemyNameplateText(enemyDefinition).toLocaleUpperCase('es');
  let previousTint = null;

  function update(hp, maxHp = enemyDefinition.maxHp) {
    const value = Number(hp);
    const maximum = Number(maxHp);
    if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0 || value <= 0) {
      sprite.visible = false;
      return;
    }
    const tint = chroniclesEnemyHealthTint(value, maximum);
    sprite.visible = true;
    if (tint === previousTint) return;
    previousTint = tint;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(12, 14, 13, 0.84)';
    context.fillRect(5, 14, canvas.width - 10, 76);
    context.strokeStyle = 'rgba(225, 204, 164, 0.55)';
    context.lineWidth = 2;
    context.strokeRect(6, 15, canvas.width - 12, 74);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 37px sans-serif';
    context.lineJoin = 'round';
    context.lineWidth = 7;
    context.strokeStyle = '#0c0e0d';
    context.strokeText(title, canvas.width / 2, 53, canvas.width - 34);
    context.fillStyle = tint;
    context.fillText(title, canvas.width / 2, 53, canvas.width - 34);
    texture.needsUpdate = true;
  }

  return {
    sprite,
    update,
    dispose() { texture.dispose(); material.dispose(); },
  };
}
