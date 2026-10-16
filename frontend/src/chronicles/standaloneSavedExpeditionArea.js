// Compatibility adapter for the original ChroniclesSaveMenu source.
// Standalone Chronicles does not yet have an authenticated save catalog.
// Never invent a saved run or a map label. Calls are only meaningful once
// real server-owned run metadata has arrived.
export function chroniclesSavedExpeditionArea(save) {
  if (!save || typeof save !== 'object') return 'Zona desconocida';
  const label = save.areaName || save.regionLabel || save.mapTitle || save.mapId;
  return typeof label === 'string' && label.trim() ? label.trim() : 'Zona desconocida';
}
