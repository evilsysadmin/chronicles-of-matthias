// One place that hears "the server no longer accepts this session": any
// authenticated request answered with 401 raises it, and the standalone
// shell answers by logging out and showing the login screen instead of
// leaving the player inside the game with a token nobody accepts.
const handlers = new Set();

export function notifySessionExpired() {
  [...handlers].forEach((handler) => {
    try { handler(); } catch { /* one listener must not break the others */ }
  });
}

export function onSessionExpired(handler) {
  if (typeof handler !== 'function') return () => {};
  handlers.add(handler);
  return () => handlers.delete(handler);
}
