import { normalizeChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';

// Export is deliberately user-initiated. A conflict is never resolved or
// written back merely because somebody opened the expedition menu.
export function chroniclesProgressionConflictBundle({
  owner, local, remote, revision, capturedAt,
}) {
  const account = String(owner || '').trim().toLowerCase();
  if (!account || !local || !remote) throw new Error('Faltan datos del conflicto para crear la copia.');
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Revisión de servidor inválida.');
  return {
    format: 'chronicles-progression-conflict-backup',
    version: 1,
    account,
    capturedAt,
    serverRevision: revision,
    localProgression: normalizeChroniclesProgression(local),
    serverProgression: normalizeChroniclesProgression(remote),
  };
}

export function downloadChroniclesProgressionConflictBundle(conflict) {
  const bundle = chroniclesProgressionConflictBundle({
    ...conflict,
    capturedAt: new Date().toISOString(),
  });
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chronicles-respaldo-progresion.json';
    link.hidden = true;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    // Firefox/Chromium may still be reading the object URL after click().
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
