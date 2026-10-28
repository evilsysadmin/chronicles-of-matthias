// Local, opt-in WebGL draw-call meter. This observes renderer.render() calls,
// NOT process CPU: CSS compositing, decoded music and browser overhead remain
// outside the counter. Normal play creates no element or sampling timer.
const DISABLED = Object.freeze({
  recordFrame() {}, setVisible() {}, dispose() {},
});

export function chroniclesRenderDiagnosticsEnabled(search) {
  return new URLSearchParams(search || '').get('chroniclesPerf') === '1';
}

export function createChroniclesRenderDiagnostics(host, {
  enabled = false,
  now = () => performance.now(),
  schedule = (callback, ms) => setInterval(callback, ms),
  cancel = (handle) => clearInterval(handle),
} = {}) {
  if (!enabled) return DISABLED;

  const element = document.createElement('output');
  element.className = 'chronicles-render-diagnostics';
  element.setAttribute('aria-hidden', 'true');
  element.style.cssText = [
    'position:absolute',
    'left:10px',
    'top:10px',
    'z-index:3',
    'pointer-events:none',
    'padding:4px 7px',
    'border:1px solid rgba(220,190,130,.35)',
    'background:rgba(7,8,10,.85)',
    'color:#f4d8a3',
    'font:11px/1.3 monospace',
    'white-space:nowrap',
  ].join(';');
  element.textContent = 'WebGL: midiendo...';
  host.appendChild(element);

  let disposed = false;
  let visible = true;
  let interval = null;
  let framesInWindow = 0;
  let totalFrames = 0;
  let sampleStart = now();

  function sample() {
    if (disposed || !visible) return;
    const elapsed = Math.max(1, now() - sampleStart);
    const fps = Math.round(framesInWindow * 1000 / elapsed);
    element.textContent = `WebGL: ${fps} FPS · ${totalFrames} frames · ${fps ? 'activo' : 'en reposo'}`;
    framesInWindow = 0;
    sampleStart = now();
  }

  function setVisible(nextVisible) {
    if (disposed) return;
    const target = Boolean(nextVisible);
    if (target === visible && interval !== null) return;
    visible = target;
    element.hidden = !visible;
    if (interval !== null) {
      cancel(interval);
      interval = null;
    }
    framesInWindow = 0;
    sampleStart = now();
    if (visible) {
      element.textContent = 'WebGL: midiendo...';
      interval = schedule(sample, 1000);
    }
  }

  function recordFrame() {
    if (disposed || !visible) return;
    framesInWindow++;
    totalFrames++;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (interval !== null) cancel(interval);
    interval = null;
    element.remove();
  }

  setVisible(true);
  return { recordFrame, setVisible, dispose };
}
