// Guard the silent SSO bootstrap separately from the game and its UI.
// Network timeout is normally shorter; this deadline also protects against
// a restore implementation that rejects late or never settles.
export function beginSilentSsoRestore(
  restore,
  onResult,
  { timeoutMs = 11000, setTimer = setTimeout, clearTimer = clearTimeout } = {},
) {
  const controller = new AbortController();
  let active = true;
  let timer = null;
  const finish = (result) => {
    if (!active) return;
    active = false;
    if (timer !== null) clearTimer(timer);
    onResult(result);
  };
  timer = setTimer(() => {
    controller.abort();
    finish('timeout');
  }, timeoutMs);
  void Promise.resolve()
    .then(() => restore({ signal: controller.signal }))
    .then(
      (restored) => {
        if (!controller.signal.aborted) finish(restored ? 'authenticated' : 'anonymous');
      },
      () => {
        if (!controller.signal.aborted) finish('error');
      },
    );
  return () => {
    active = false;
    controller.abort();
    if (timer !== null) clearTimer(timer);
  };
}
