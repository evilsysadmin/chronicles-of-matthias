// Local A/B isolation for CPU investigations; never changes saved settings.
// Diagnostics must be explicitly enabled so ordinary URL parameters cannot
// accidentally silence the game or remove environmental light.
export function chroniclesPerfIsolationFlags(search = '') {
  const query = new URLSearchParams(search);
  if (query.get('chroniclesPerf') !== '1') {
    return { disableMusic: false, disableTorchGlows: false };
  }
  return {
    disableMusic: query.get('chroniclesMusic') === '0',
    disableTorchGlows: query.get('chroniclesTorches') === '0',
  };
}

// The renderer's background-tab pause takes precedence over debug switches.
export function chroniclesPerfTorchesVisible(pageVisible, disableTorchGlows) {
  return Boolean(pageVisible) && !disableTorchGlows;
}
