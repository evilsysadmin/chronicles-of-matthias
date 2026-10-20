import { getAudioContext } from '../audioContext.js';
import { getChroniclesFxVolume } from './chroniclesAudioSettings.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesVolleyPresentationShooterIds } from './chroniclesVolleyPresentation.js';
import { chroniclesEquippedItem } from './chroniclesEquipment.js';
import { chroniclesAttackMode, chroniclesOpeningVolleyShots } from '../chroniclesOfMatthias.js';

function actionType(action) {
  return typeof action === 'string' ? action : action?.type;
}

function totalPartyHp(state) {
  return (state?.party || []).reduce((sum, member) => sum + Math.max(0, Number(member?.hp || 0)), 0);
}

function enemyHpSnapshot(state) {
  const map = state ? chroniclesMapForState(state) : null;
  return (map?.enemies || []).map((enemy) => ({
    id: enemy.id,
    hp: Math.max(0, Number(state?.[enemy.hpKey] || 0)),
  }));
}

// Actual weapon family, never an inferred effect from an attack hotkey.
export function chroniclesWeaponImpactFamily(family) {
  if (family === 'bow' || family === 'crossbow') return 'arrow';
  if (family === 'axe') return 'cleave';
  if (family === 'sword' || family === 'dagger') return 'cut';
  if (family === 'spear') return 'pierce';
  return 'blunt'; // staff, mace, sling, unarmed and unknown
}

function partyImpactFamily(state, memberId, requestedMode = 'auto') {
  const mode = requestedMode === 'auto' ? chroniclesAttackMode(state, memberId) : requestedMode;
  return chroniclesWeaponImpactFamily(
    chroniclesEquippedItem(state, memberId, mode === 'missile' ? 'missile' : 'weapon')?.weaponFamily,
  );
}

function enemyImpactFamily(state, enemyId) {
  const enemy = chroniclesMapForState(state)?.enemies?.find((entry) => entry.id === enemyId);
  if (!enemy) return 'blunt';
  if (enemy.weaponFamily) return chroniclesWeaponImpactFamily(enemy.weaponFamily);
  const type = [enemy.visualType, enemy.enemyBuild?.archetype].filter(Boolean).join(' ').toLowerCase();
  if (/archer|crossbow|bowman/.test(type)) return 'arrow';
  if (/axeman|axe-wielder/.test(type)) return 'cleave';
  if (/swordsman|sword-wielder/.test(type)) return 'cut';
  if (/spearman|pikeman/.test(type)) return 'pierce';
  return 'blunt'; // Don't invent steel weapons for creatures with unknown attacks.
}

export function chroniclesActionAudioCue(previous, next, action) {
  if (!previous || !next) return null;
  const type = actionType(action);
  const partyBefore = totalPartyHp(previous);
  const partyAfter = totalPartyHp(next);
  const hurt = partyAfter < partyBefore;
  if (type === 'turn-left' || type === 'turn-right') return 'turn';

  if (type === 'forward' || type === 'backward') {
    if (next.phase === 'escaped' && previous.phase !== 'escaped') return 'exit';
    // A trap or a waiting foe: the blow is louder than the footstep.
    if (hurt) return 'hurt';
    return previous.x !== next.x || previous.y !== next.y ? 'step' : 'blocked';
  }

  const beforeEnemies = enemyHpSnapshot(previous);
  const afterById = new Map(enemyHpSnapshot(next).map((enemy) => [enemy.id, enemy.hp]));
  const damaged = beforeEnemies.filter((enemy) => (afterById.get(enemy.id) ?? enemy.hp) < enemy.hp);

  if (type === 'enemy-turn') {
    // The turn engine records actual attack attempts: roaming or paralysis
    // must NEVER generate a fake 'miss' whoosh.
    const swing = (next.enemyTurnEvents || [])
      .find((event) => event.type === 'attack' && event.enemyId === action?.enemyId);
    if (!swing) return null;
    const family = enemyImpactFamily(previous, action.enemyId);
    return hurt && swing.damage > 0 ? `hurt:${family}` : `miss:${family}`;
  }

  if (type === 'cast' || type === 'use-item') {
    if (damaged.length) return 'spell-hit';
    if (hurt) return 'hurt';
    if (partyAfter > partyBefore) return 'heal';
    return next.message !== previous.message && next !== previous ? 'spell' : null;
  }

  if (type === 'volley') {
    const fired = chroniclesVolleyPresentationShooterIds(previous);
    if (!fired.length) return null;
    // Preserve one audible event for each actual projectile; an archer,
    // crossbowman and slinger sound distinct even in the same company.
    const families = fired.map((memberId) => (
      chroniclesEquippedItem(previous, memberId, 'missile')?.weaponFamily || 'bow'
    ));
    const shots = chroniclesOpeningVolleyShots(previous);
    const landed = shots.shots.find((shot) => shot.damage > 0);
    const impact = landed
      ? chroniclesWeaponImpactFamily(chroniclesEquippedItem(previous, landed.memberId, 'missile')?.weaponFamily)
      : null;
    // A volley has one restrained impact at most, never a clang per projectile.
    return [
      `volley:${families.join(',')}`,
      impact && damaged.length ? `impact:${impact}` : shots.target ? 'miss:arrow' : null,
      hurt ? `hurt:${enemyImpactFamily(previous, shots.target?.id)}` : null,
    ].filter(Boolean).join('|');
  }

  if (type !== 'attack') return hurt ? 'hurt' : null;

  if (previous.combatRules !== 'mm3') {
    if (!damaged.length) return hurt ? 'hurt' : 'miss';
    const defeated = damaged.some((enemy) => enemy.hp > 0 && (afterById.get(enemy.id) ?? enemy.hp) === 0);
    return defeated ? 'defeat' : hurt ? 'retaliation' : 'hit';
  }

  const family = partyImpactFamily(previous, action?.memberId || 'matthias', action?.mode || 'auto');
  const strike = !damaged.length ? 'miss'
    : damaged.some((enemy) => enemy.hp > 0 && (afterById.get(enemy.id) ?? enemy.hp) === 0) ? 'defeat' : 'hit';
  return `${strike}:${family}${hurt ? '|hurt:blunt' : ''}`;
}

function connectTone(ctx, destination, { frequency, duration, gain, type = 'triangle', delay = 0, endFrequency = null }) {
  if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
  const oscillator = ctx.createOscillator();
  const level = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  level.gain.setValueAtTime(0.0001, start);
  level.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.008, duration * 0.3));
  level.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(level);
  level.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function connectNoise(ctx, destination, { duration, gain, centerHz, delay = 0, type = 'bandpass' }) {
  if (
    typeof ctx.createBuffer !== 'function'
    || typeof ctx.createBufferSource !== 'function'
    || typeof ctx.createBiquadFilter !== 'function'
    || typeof ctx.createGain !== 'function'
  ) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const envelope = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * envelope;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = centerHz;
  filter.Q.value = type === 'bandpass' ? 0.8 : 0.35;
  const level = ctx.createGain();
  const start = ctx.currentTime + delay;
  level.gain.setValueAtTime(Math.max(0.0002, gain), start);
  level.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(level);
  level.connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playBasicCue(ctx, cue, volume) {
  const bus = ctx.createGain();
  bus.gain.value = 0.82 * volume;
  bus.connect(ctx.destination);

  if (cue.startsWith('volley:')) {
    // Procedural transient instruments, not heavyweight samples. Stagger
    // no more than six real releases and normalize loudness for groups.
    const families = cue.slice('volley:'.length).split(',').slice(0, 6);
    const attenuation = 1 / Math.sqrt(Math.max(1, families.length));
    families.forEach((family, index) => {
      const delay = index * 0.026;
      if (family === 'crossbow') {
        // Mechanical catch followed by the heavier bolt release.
        connectNoise(ctx, bus, { duration: 0.045, gain: 0.047 * attenuation, centerHz: 920, delay, type: 'bandpass' });
        connectTone(ctx, bus, { frequency: 166, endFrequency: 91, duration: 0.13, gain: 0.048 * attenuation, delay: delay + 0.014 });
      } else if (family === 'sling') {
        // Round stone whistles briefly through the air.
        connectNoise(ctx, bus, { duration: 0.105, gain: 0.017 * attenuation, centerHz: 2700, delay, type: 'highpass' });
        connectTone(ctx, bus, { frequency: 720, endFrequency: 270, duration: 0.13, gain: 0.018 * attenuation, type: 'sine', delay });
      } else {
        // Bowstring pluck plus fletching hiss.
        connectTone(ctx, bus, { frequency: 295, endFrequency: 142, duration: 0.08, gain: 0.035 * attenuation, delay });
        connectNoise(ctx, bus, { duration: 0.11, gain: 0.018 * attenuation, centerHz: 1900, delay: delay + 0.015, type: 'highpass' });
      }
    });
    return;
  }
  if (cue === 'step') {
    connectNoise(ctx, bus, { duration: 0.055, gain: 0.024, centerHz: 430 });
    connectTone(ctx, bus, { frequency: 92, endFrequency: 74, duration: 0.085, gain: 0.032 });
    return;
  }
  if (cue === 'turn') {
    connectNoise(ctx, bus, { duration: 0.045, gain: 0.011, centerHz: 760, type: 'lowpass' });
    connectTone(ctx, bus, { frequency: 126, endFrequency: 108, duration: 0.05, gain: 0.01 });
    return;
  }
  if (cue === 'blocked') {
    connectNoise(ctx, bus, { duration: 0.035, gain: 0.025, centerHz: 520 });
    connectTone(ctx, bus, { frequency: 88, endFrequency: 61, duration: 0.12, gain: 0.046 });
    return;
  }
  if (cue === 'miss') {
    connectNoise(ctx, bus, { duration: 0.09, gain: 0.018, centerHz: 1350 });
    connectTone(ctx, bus, { frequency: 210, endFrequency: 155, duration: 0.07, gain: 0.014 });
    return;
  }
  if (cue === 'spell' || cue === 'spell-hit') {
    // A shimmer: two sine voices rising a fifth, with air on top.
    connectTone(ctx, bus, { frequency: 523, endFrequency: 784, duration: 0.24, gain: 0.02, type: 'sine' });
    connectTone(ctx, bus, { frequency: 659, endFrequency: 988, duration: 0.28, gain: 0.014, type: 'sine', delay: 0.05 });
    connectNoise(ctx, bus, { duration: 0.2, gain: 0.008, centerHz: 4200, type: 'highpass' });
    if (cue === 'spell-hit') {
      connectNoise(ctx, bus, { duration: 0.06, gain: 0.04, centerHz: 900, delay: 0.2 });
      connectTone(ctx, bus, { frequency: 170, endFrequency: 96, duration: 0.16, gain: 0.04, delay: 0.2 });
    }
    return;
  }
  if (cue === 'heal') {
    [392, 494, 587].forEach((frequency, index) => {
      connectTone(ctx, bus, { frequency, duration: 0.34, gain: 0.014, type: 'sine', delay: index * 0.07 });
    });
    return;
  }
  if (cue === 'hurt') {
    // A dull blow on the company: low thump and a grunt of noise.
    connectTone(ctx, bus, { frequency: 120, endFrequency: 58, duration: 0.2, gain: 0.06 });
    connectNoise(ctx, bus, { duration: 0.08, gain: 0.04, centerHz: 320, type: 'lowpass' });
    return;
  }
  if (cue === 'exit') {
    connectTone(ctx, bus, { frequency: 196, endFrequency: 246, duration: 0.18, gain: 0.026 });
    connectTone(ctx, bus, { frequency: 294, endFrequency: 370, duration: 0.22, gain: 0.018, delay: 0.055 });
    return;
  }

  connectNoise(ctx, bus, { duration: 0.045, gain: cue === 'defeat' ? 0.045 : 0.034, centerHz: 780 });
  connectTone(ctx, bus, {
    frequency: cue === 'defeat' ? 132 : 158,
    endFrequency: cue === 'defeat' ? 72 : 112,
    duration: cue === 'defeat' ? 0.2 : 0.13,
    gain: cue === 'defeat' ? 0.052 : 0.041,
  });
  if (cue === 'retaliation') {
    connectNoise(ctx, bus, { duration: 0.04, gain: 0.027, centerHz: 610, delay: 0.085 });
    connectTone(ctx, bus, { frequency: 104, endFrequency: 72, duration: 0.11, gain: 0.038, delay: 0.082 });
  } else if (cue === 'defeat') {
    connectTone(ctx, bus, { frequency: 246, endFrequency: 164, duration: 0.16, gain: 0.018, delay: 0.035 });
  }
}

// Short three-step timbre cycle, not three layers played at once. All
// variations remain within a tight loudness range and respect the FX slider.
const IMPACT_VARIATIONS = Object.freeze([
  Object.freeze({ pitch: 0.963, air: 1.06, level: 0.985 }),
  Object.freeze({ pitch: 1.036, air: 0.94, level: 0.985 }),
  Object.freeze({ pitch: 1, air: 1, level: 1 }),
]);

export function chroniclesImpactAudioVariation(index) {
  const step = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  return IMPACT_VARIATIONS[((step % IMPACT_VARIATIONS.length) + IMPACT_VARIATIONS.length) % IMPACT_VARIATIONS.length];
}

let impactVariationIndex = 0;

function playImpactCue(ctx, cue, volume, delay = 0, variation = IMPACT_VARIATIONS[0]) {
  const [event, family = 'blunt'] = cue.split(':');
  const bus = ctx.createGain();
  bus.gain.value = 0.58 * volume * variation.level;
  const tone = (options) => connectTone(ctx, bus,{
    ...options,
    frequency: options.frequency * variation.pitch,
    endFrequency: options.endFrequency ? options.endFrequency * variation.pitch : null,
  });
  const noise = (options) => connectNoise(ctx, bus,{
    ...options,
    centerHz: options.centerHz * variation.air,
  });
  bus.connect(ctx.destination);
  const weight = event === 'hurt' ? 0.72 : event === 'defeat' ? 1.05 : 1;

  if (event === 'miss') {
    // Zziuumm! The weapon whistles past; NO contact thud for a miss.
    const heavy = family === 'blunt' || family === 'cleave';
    noise({
      duration: heavy ? 0.14 : 0.19, gain: (heavy ? 0.027 : 0.019) * weight,
      centerHz: heavy ? 780 : family === 'arrow' ? 2800 : 2050,
      type: 'bandpass', delay,
    });
    tone({
      frequency: heavy ? 235 : family === 'arrow' ? 920 : 590,
      endFrequency: heavy ? 110 : family === 'arrow' ? 290 : 190,
      duration: heavy ? 0.15 : 0.21, gain: (heavy ? 0.013 : 0.01) * weight,
      type: 'sine', delay,
    });
    return;
  }

  // Tight, almost dry transients: convincing hit without a metallic clatter.
  if (family === 'blunt') {
    tone({ frequency: 131, endFrequency: 60, duration: 0.12, gain: 0.052 * weight, delay });
    noise({ duration: 0.065, gain: 0.023 * weight, centerHz: 400, type: 'lowpass', delay });
  } else if (family === 'cleave') {
    noise({ duration: 0.13, gain: 0.029 * weight, centerHz: 1150, delay });
    tone({ frequency: 162, endFrequency: 75, duration: 0.15, gain: 0.045 * weight, delay: delay + 0.015 });
  } else if (family === 'cut') {
    noise({ duration: 0.087, gain: 0.024 * weight, centerHz: 2000, delay });
    tone({ frequency: 255, endFrequency: 120, duration: 0.11, gain: 0.025 * weight, delay: delay + 0.009 });
  } else if (family === 'pierce') {
    noise({ duration: 0.045, gain: 0.026 * weight, centerHz: 1750, delay });
    tone({ frequency: 215, endFrequency: 120, duration: 0.096, gain: 0.026 * weight, delay });
  } else if (family === 'arrow') {
    noise({ duration: 0.052, gain: 0.019 * weight, centerHz: 1530, delay });
    tone({ frequency: 375, endFrequency: 155, duration: 0.08, gain: 0.018 * weight, delay });
  }

  // Small body response on taking damage; no second heavy impact instrument.
  if (event === 'hurt' && family !== 'blunt') {
    tone({ frequency: 100, endFrequency: 65, duration: 0.1, gain: 0.021, delay: delay + 0.02 });
  }
}

function playCue(cue) {
  const volume = getChroniclesFxVolume();
  if (!cue || volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume?.().catch(() => {});

  // Cap voices and normalize combined energy. Multi-hit turns stay composed.
  const layers = cue.split('|').slice(0, 3);
  const mix = volume / Math.sqrt(layers.length);
  layers.forEach((layer, index) => {
    if (/^(hit|defeat|impact|hurt|miss):/.test(layer) || layer === 'miss') {
      playImpactCue(
        ctx, layer === 'miss' ? 'miss:blunt' : layer,
        mix, index ? 0.13 + (index - 1) * 0.07 : 0,
        chroniclesImpactAudioVariation(impactVariationIndex++),
      );
    } else {
      playBasicCue(ctx, layer, mix);
    }
  });
}

export function playChroniclesActionSound(previous, next, action) {
  playCue(chroniclesActionAudioCue(previous, next, action));
}

// A short sample at the chosen SFX level, so moving the slider is audible.
export function playChroniclesPreviewSound() {
  playCue('hit:cut');
}
