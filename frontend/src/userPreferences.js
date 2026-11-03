import { STORAGE_LOCAL, getStorageItem, setStorageItem } from './safeStorage.js';
import { PROFILE_CHANGED_EVENT, setProfileStorageItem } from './profileKeys.js';
export const UI_LANGUAGE_KEY = 'chess-study-ui-language';
export const REDUCED_MOTION_KEY = 'chess-study-reduced-motion';
export const DEVICE_RENDER_QUALITY_KEY = 'chess-study-device-render-quality-v1';
export const USER_PREFERENCES_CHANGED_EVENT = 'chess-study-user-preferences-changed';
export const SUPPORTED_UI_LANGUAGES = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];
export const RENDER_QUALITY_OPTIONS = [
  { id: 'auto', label: 'Automática' },
  { id: 'low', label: 'Baja' },
  { id: 'medium', label: 'Media' },
  { id: 'high', label: 'Alta' },
  { id: 'ultra', label: 'Ultra' },
];

let effectiveReducedMotionCache;
let reducedMotionMedia = null;
let reducedMotionListenersInstalled = false;

function invalidateEffectiveReducedMotionCache() {
  effectiveReducedMotionCache = undefined;
}

function ensureReducedMotionMedia() {
  if (reducedMotionMedia || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return reducedMotionMedia;
  }

  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleSystemMotionChange = () => {
    invalidateEffectiveReducedMotionCache();
    syncReducedMotionDataset();
    window.dispatchEvent(new Event(USER_PREFERENCES_CHANGED_EVENT));
  };
  if (typeof reducedMotionMedia.addEventListener === 'function') {
    reducedMotionMedia.addEventListener('change', handleSystemMotionChange);
  } else if (typeof reducedMotionMedia.addListener === 'function') {
    reducedMotionMedia.addListener(handleSystemMotionChange);
  }
  return reducedMotionMedia;
}

function installReducedMotionInvalidationListeners() {
  if (reducedMotionListenersInstalled || typeof window === 'undefined') return;
  reducedMotionListenersInstalled = true;
  window.addEventListener(PROFILE_CHANGED_EVENT, invalidateEffectiveReducedMotionCache);
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === REDUCED_MOTION_KEY) invalidateEffectiveReducedMotionCache();
  });
}

export function getUiLanguage() {
  const value = getStorageItem(STORAGE_LOCAL, UI_LANGUAGE_KEY) || 'es';
  return SUPPORTED_UI_LANGUAGES.some((row) => row.id === value) ? value : 'es';
}

export function setUiLanguage(value) {
  const normalized = SUPPORTED_UI_LANGUAGES.some((row) => row.id === value) ? value : 'es';
  setProfileStorageItem(UI_LANGUAGE_KEY, normalized);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USER_PREFERENCES_CHANGED_EVENT));
  return normalized;
}

export function getReducedMotionPreference() {
  const value = getStorageItem(STORAGE_LOCAL, REDUCED_MOTION_KEY);
  if (value === '1') return 'reduce';
  if (value === '0') return 'allow';
  return 'system';
}

export function systemPrefersReducedMotion() {
  return Boolean(ensureReducedMotionMedia()?.matches);
}

export function reducedMotionStatus({ systemReduced } = {}) {
  const preference = getReducedMotionPreference();
  const reducedBySystem = systemReduced ?? systemPrefersReducedMotion();
  if (preference === 'reduce') return { effective: true, source: 'app', preference, systemReduced: reducedBySystem };
  if (preference === 'allow') return { effective: false, source: 'app', preference, systemReduced: reducedBySystem };
  return {
    effective: reducedBySystem,
    source: reducedBySystem ? 'system' : 'none',
    preference,
    systemReduced: reducedBySystem,
  };
}

export function getReducedMotion() {
  return getReducedMotionPreference() === 'reduce';
}

export function getEffectiveReducedMotion(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'systemReduced')) {
    return reducedMotionStatus(options).effective;
  }
  installReducedMotionInvalidationListeners();
  if (effectiveReducedMotionCache !== undefined) return effectiveReducedMotionCache;
  effectiveReducedMotionCache = reducedMotionStatus({ systemReduced: systemPrefersReducedMotion() }).effective;
  return effectiveReducedMotionCache;
}

function syncReducedMotionDataset() {
  if (typeof document === 'undefined') return;
  const status = reducedMotionStatus();
  document.documentElement.dataset.reducedMotion = status.effective ? 'true' : 'false';
  document.documentElement.dataset.motionPreference = status.preference;
}

export function setReducedMotion(value) {
  const normalized = !!value;
  invalidateEffectiveReducedMotionCache();
  setProfileStorageItem(REDUCED_MOTION_KEY, normalized ? '1' : '0');
  syncReducedMotionDataset();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USER_PREFERENCES_CHANGED_EVENT));
  return normalized;
}

export function getRenderQualityPreference() {
  const stored = getStorageItem(STORAGE_LOCAL, DEVICE_RENDER_QUALITY_KEY);
  return RENDER_QUALITY_OPTIONS.some((option) => option.id === stored) ? stored : 'auto';
}

export function setRenderQualityPreference(value) {
  const normalized = RENDER_QUALITY_OPTIONS.some((option) => option.id === value) ? value : 'auto';
  setStorageItem(STORAGE_LOCAL, DEVICE_RENDER_QUALITY_KEY, normalized);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USER_PREFERENCES_CHANGED_EVENT));
  return normalized;
}
