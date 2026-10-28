// Local, opt-in WebGL draw-call meter. It observes renderer.render() calls,
// NOT process CPU: CSS compositing, decoded music and browser overhead remain
// outside the counter. Normal play creates no element or sampling timer.
//
// A *diagnostic* that wakes the browser every second during idle would bias
// the very CPU comparison it is meant to support. Sample once after the
// last drawn frame, report zero WebGL FPS, then park until another render.
const DISABLED = Object.freeze({
  recordFrame() {}, setVisible() {}, dispose() {},
});

export function chroniclesRenderDiagnosticsEnabled(search) {
  return new URLSearchParams(search || '').get('chroniclesPerf') === '1';
}

export function createChroniclesRenderDiagnostics(host, {
  enabled = false,
  now = () => performance.now(),
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle),
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
  let visible = false;
  let timer = null;
  let framesInWindow = 0;
  let totalFrames = 0;
  let sampleStart = now();

  function armSample() {
    if (disposed || !visible || timer !== null) return;
    sampleStart = now();
    timer = schedule(sample, 1000);
  }

  function sample() {
    timer = null;
    if (disposed || !visible) return;
    const elapsed = Math.max(1, now() - sampleStart);
    const frameCount = framesInWindow;
    const fps = Math.round(frameCount * 1000 / elapsed);
    element.textContent = `WebGL: ${fps} FPS · ${totalFrames} frames · ${frameCount ? 'activo' : 'en reposo'}`;
    framesInWindow = 0;
    if (frameCount) armSample();
    // An idle sample has no successor. The next actual WebGL frame re-arms it.
  }

  function setVisible(nextVisible) {
    if (disposed) return;
    const target = Boolean(nextVisible);
    if (target === visible) return;
    visible = target;
    element.hidden = !visible;
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    framesInWindow = 0;
    if (visible) {
      element.textContent = 'WebGL: midiendo...';
      armSample();
    }
  }

  function recordFrame() {
    if (disposed || !visible) return;
    framesInWindow++;
    totalFrames++;
    armSample();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (timer !== null) cancel(timer);
    timer = null;
    element.remove();
  }

  setVisible(true);
  return { recordFrame, setVisible, dispose };
}
