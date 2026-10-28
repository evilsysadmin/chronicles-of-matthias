// Do not wake an otherwise idle Three.js scene for duplicate layout events.
// The pixel-ratio cap matches the renderer's desktop/touch quality budget.
export function chroniclesThreeViewport(width, height, devicePixelRatio, coarse = false) {
  const dimension = (value) => Math.max(1, Math.floor(Number(value) || 1));
  const dpr = Number(devicePixelRatio);
  return {
    width: dimension(width),
    height: dimension(height),
    pixelRatio: Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, coarse ? 1.2 : 1.65),
  };
}

export function chroniclesThreeViewportChanged(previous, next) {
  return !previous || previous.width !== next.width
    || previous.height !== next.height || previous.pixelRatio !== next.pixelRatio;
}
