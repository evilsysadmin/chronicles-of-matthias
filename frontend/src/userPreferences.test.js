import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStorageMemoryFallback } from './safeStorage.js';
import {
  DEVICE_RENDER_QUALITY_KEY,
  REDUCED_MOTION_KEY,
  getEffectiveReducedMotion,
  getReducedMotion,
  getReducedMotionPreference,
  getRenderQualityPreference,
  getUiLanguage,
  reducedMotionStatus,
  setReducedMotion,
  setRenderQualityPreference,
  setUiLanguage,
} from './userPreferences.js';

describe('user preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStorageMemoryFallback();
    vi.unstubAllEnvs();
    // Invalida la caché entre tests sin depender de window/jsdom; luego deja
    // storage limpio para que cada caso conserve el mismo estado inicial.
    setReducedMotion(false);
    localStorage.clear();
    clearStorageMemoryFallback();
  });

  it('mantiene idioma en valores realmente soportados', () => {
    expect(getUiLanguage()).toBe('es');
    expect(setUiLanguage('en')).toBe('en');
    expect(getUiLanguage()).toBe('en');
  });

  it('mantiene la preferencia accesible de movimiento reducido', () => {
    expect(getReducedMotion()).toBe(false);
    expect(setReducedMotion(true)).toBe(true);
    expect(getReducedMotion()).toBe(true);
  });

  it('usa calidad automática por defecto y guarda el override sólo en este dispositivo', () => {
    expect(getRenderQualityPreference()).toBe('auto');
    expect(setRenderQualityPreference('ultra')).toBe('ultra');
    expect(localStorage.getItem(DEVICE_RENDER_QUALITY_KEY)).toBe('ultra');
    expect(getRenderQualityPreference()).toBe('ultra');

    expect(setRenderQualityPreference('patata-cuántica')).toBe('auto');
    expect(localStorage.getItem(DEVICE_RENDER_QUALITY_KEY)).toBe('auto');
  });

  it('honra el sistema por defecto pero una elección explícita puede permitir movimiento', () => {
    expect(getReducedMotionPreference()).toBe('system');
    expect(reducedMotionStatus({ systemReduced: true })).toMatchObject({ effective: true, source: 'system', preference: 'system' });
    expect(getEffectiveReducedMotion({ systemReduced: true })).toBe(true);

    setReducedMotion(false);
    expect(getReducedMotionPreference()).toBe('allow');
    expect(reducedMotionStatus({ systemReduced: true })).toMatchObject({ effective: false, source: 'app', preference: 'allow' });
    expect(getEffectiveReducedMotion({ systemReduced: true })).toBe(false);

    setReducedMotion(true);
    expect(getReducedMotionPreference()).toBe('reduce');
    expect(reducedMotionStatus({ systemReduced: false })).toMatchObject({ effective: true, source: 'app', preference: 'reduce' });
  });

  it('cachea el reduced-motion efectivo hasta que una señal real invalida el hot path', () => {
    setReducedMotion(false);
    expect(getEffectiveReducedMotion()).toBe(false);

    // Cambiar storage a pelo no debe convertir el RAF en un lector de localStorage.
    localStorage.setItem(REDUCED_MOTION_KEY, '1');
    expect(getEffectiveReducedMotion()).toBe(false);

    // El setter normal es una señal real e invalida de forma síncrona.
    setReducedMotion(true);
    expect(getEffectiveReducedMotion()).toBe(true);

    setReducedMotion(false);
    expect(getEffectiveReducedMotion()).toBe(false);
  });
});