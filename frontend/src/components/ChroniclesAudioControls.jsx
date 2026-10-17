import { useEffect, useRef, useState } from 'react';
import { getAmbientVolume, setAmbientVolume } from '../sound.js';
import { getChroniclesFxVolume, setChroniclesFxVolume } from '../chronicles/chroniclesAudioSettings.js';
import { playChroniclesPreviewSound } from '../chronicles/chroniclesActionAudio.js';

const percent = (value) => Math.round(value * 100);

function VolumeRow({ id, label, ariaLabel, icon, value, onChange, onRelease }) {
  const lastRef = useRef(value || 0.75);
  if (value > 0) lastRef.current = value;
  return (
    <div className="chronicles-audio-row">
      <div className="chronicles-audio-row__label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{percent(value)} %</output>
      </div>
      <div className="chronicles-audio-row__slider">
        <button
          type="button"
          aria-label={value > 0 ? `Silenciar ${ariaLabel}` : `Activar ${ariaLabel}`}
          aria-pressed={value === 0}
          onClick={() => {
            const next = value > 0 ? 0 : lastRef.current;
            onChange(next);
            if (next > 0) onRelease?.();
          }}
        >{value > 0 ? icon : '×'}</button>
        <input
          id={id}
          aria-label={`Volumen de ${ariaLabel} de Chronicles`}
          type="range"
          min="0"
          max="100"
          step="5"
          value={percent(value)}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
          onPointerUp={() => onRelease?.()}
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') onRelease?.();
          }}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}

// Music and SFX levels for Chronicles. The same two sliders live in the
// in-game menu and in the cog on the expedition book; both read and write the
// same stored preferences, so a change in one is what the other shows next.
export default function ChroniclesAudioControls({ idPrefix = 'chronicles', legend = 'SONIDO', hint = null, className = 'chronicles-audio-controls', id }) {
  const [music, setMusic] = useState(getAmbientVolume);
  const [fx, setFx] = useState(getChroniclesFxVolume);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Another surface (media keys, the other panel) may move the music level.
    const sync = () => setMusic(getAmbientVolume());
    window.addEventListener('chess-ambient-transport', sync);
    return () => window.removeEventListener('chess-ambient-transport', sync);
  }, []);

  return (
    <fieldset id={id} className={className}>
      <legend>{legend}</legend>
      <VolumeRow
        id={`${idPrefix}-music-volume`}
        label="Música de Chronicles"
        ariaLabel="música"
        icon="♫"
        value={music}
        onChange={(value) => setMusic(setAmbientVolume(value))}
      />
      <VolumeRow
        id={`${idPrefix}-sfx-volume`}
        label="Efectos · SFX"
        ariaLabel="efectos"
        icon="✦"
        value={fx}
        onChange={(value) => setFx(setChroniclesFxVolume(value))}
        onRelease={playChroniclesPreviewSound}
      />
      {hint && <small>{hint}</small>}
    </fieldset>
  );
}
