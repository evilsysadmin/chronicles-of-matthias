// Keep the mobile HUD inside the actually visible browser area. On Android,
// the CSS dynamic viewport can briefly lag the visual viewport after rotation
// or when the browser toolbars change size.
export function attachChroniclesVisualViewport(root, viewport) {
  if (!root || !viewport) return () => {};

  const sync = () => {
    const height = Number(viewport.height);
    if (!Number.isFinite(height) || height <= 0) return;
    const offsetTop = Number(viewport.offsetTop);
    root.style.setProperty('--chronicles-visual-height', `${Math.floor(height)}px`);
    root.style.setProperty('--chronicles-visual-top',
      `${Math.max(0, Number.isFinite(offsetTop) ? Math.floor(offsetTop) : 0)}px`);
  };

  sync();
  viewport.addEventListener('resize', sync);
  viewport.addEventListener('scroll', sync);
  return () => {
    viewport.removeEventListener('resize', sync);
    viewport.removeEventListener('scroll', sync);
    root.style.removeProperty('--chronicles-visual-height');
    root.style.removeProperty('--chronicles-visual-top');
  };
}
