import './ChroniclesSpellIcon.css';

// Original tiny pixel portraits for each currently implemented MM3 spell.
// Pure presentation: do not infer spells, effects, costs or availability here.
// Colours are authored locally, without Unicode emoji, external images or CDNs.
const PALETTES = Object.freeze({
  mend: ['#204a36', '#69b782', '#f6e8a5'],
  arcane: ['#27395c', '#608bd9', '#c1e8ff'],
  fire: ['#74331d', '#e96e34', '#ffdc69'],
  ice: ['#205569', '#5ba9d0', '#d3f4f7'],
  poison: ['#31502b', '#7da24a', '#d5db74'],
  holy: ['#675033', '#d7b266', '#fff2c4'],
  storm: ['#443d68', '#9581e0', '#f6e59b'],
  ward: ['#375662', '#83a7af', '#fcf3d1'],
});

// Path coordinates deliberately follow a 24x24 integer grid, as with the
// inventory miniatures. Distinct silhouettes survive at their 40px display size.
const ART = Object.freeze({
  'first-aid': ['M9 2h6v6h7v8h-7v6H9v-6H2V8h7z', 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z', 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z', 'mend'],
  'flying-fist': ['M5 4h4v4h1V3h4v5h1V5h4v5h2v5h-3v4h-3v3H8v-3H5v-3H3V9h2z', 'M6 6h2v5h3V5h2v6h3V7h2v7h-3v3h-2v3H9v-3H7v-3H5v-3h1z', 'M8 9h2v3H8z M12 8h2v4h-2z M17 11h2v2h-2z', 'arcane'],
  'elemental-arrow': ['M2 17h9v-4h2v-3h3V7h6v7h-4v3h-3v3h-4v2H2z', 'M4 18h8v-4h3v-3h3V9h2v3h-3v3h-3v3h-3v2H4z', 'M15 2h3v4h2v2h-4V6h-2z M8 16h4v2H8z', 'fire'],
  'detect-magic': ['M1 12l6-6h10l6 6-6 6H7z', 'M4 12l4-4h8l4 4-4 4H8z', 'M10 9h4v6h-4z M11 4h2v2h-2z M19 3h2v3h-2z', 'arcane'],
  'cold-ray': ['M10 1h4v8h8v5h-8v9h-4v-9H2V9h8z', 'M11 3h2v8h7v2h-7v8h-2v-8H4v-2h7z', 'M5 5h3v3H5z M16 5h3v3h-3z M5 16h3v3H5z M16 16h3v3h-3z', 'ice'],
  'poison-cloud': ['M2 9h3V6h4V3h7v4h4v3h3v8h-5v3H7v-3H2z', 'M4 11h3V8h4V5h3v4h4v3h3v4h-5v3H9v-3H4z', 'M9 11h3v3H9z M15 12h3v3h-3z M12 16h2v2h-2z', 'poison'],
  'holy-strike': ['M11 1h3v9h3v3h5v3h-8v6h-3v-6H3v-3h5v-3h3z', 'M12 3h1v9h5v3h-5v6h-1v-6H5v-1h7z', 'M4 5h3v2H4z M18 5h3v2h-3z M3 19h3v2H3z M18 19h3v2h-3z', 'holy'],
  'lightning-bolt': ['M14 1h7l-6 9h6L8 23l3-10H3z', 'M15 3h3l-6 9h5L10 19l3-8H7z', 'M14 4h2l-5 8h3l-2 3 1-5H9z', 'storm'],
  'heal-wounds': ['M2 6h3V3h6v3h2V3h6v3h3v9h-3v3h-4v3H9v-3H5v-3H2z', 'M5 7h3V5h2v3h4V5h3v2h2v7h-3v3h-3v2h-2v-2H8v-3H5z', 'M11 9h3v3h3v2h-3v3h-3v-3H8v-2h3z', 'mend'],
  fireball: ['M10 1h4v4h4v3h3v4h2v6h-4v3H7v-2H4v-5H2V8h4V5h4z', 'M11 4h3v4h3v3h2v6h-3v2H9v-3H6v-5h3V8h2z', 'M12 8h2v4h3v3h-3v3h-3v-4H9v-2h3z', 'fire'],
  paralyze: ['M2 3h8v3H5v5h5v3H2z M14 10h8v11h-8v-3h5v-5h-5z M8 11h8v4H8z', 'M3 4h6v1H4v7h5v1H3z M15 11h6v9h-6v-1h5v-7h-5z M9 12h6v2H9z', 'M10 7h3v3h-3z M13 15h3v3h-3z M6 17h3v3H6z', 'storm'],
  'mass-heal': ['M3 7h5V4h4v3h4V4h4v3h3v11h-5v3h-5v-3H9v3H4v-3H1V7z', 'M5 9h3V6h2v4h6V6h2v4h3v6h-4v3h-3v-3H9v3H6v-3H3v-6h2z', 'M6 11h3v2H6z M12 10h2v5h-2z M10 12h6v2h-6z M18 11h2v2h-2z', 'mend'],
  'faith-ward': ['M4 2h16v13l-8 8-8-8z', 'M6 4h12v10l-6 6-6-6z', 'M11 6h2v4h4v2h-4v5h-2v-5H7v-2h4z', 'ward'],
});

export const CHRONICLES_SPELL_ICON_IDS = Object.freeze(Object.keys(ART));

export default function ChroniclesSpellIcon({ spell }) {
  const id = spell?.id;
  const icon = ART[id] || (spell?.kind === 'heal' ? ART['first-aid'] : ART['detect-magic']);
  const palette = PALETTES[icon[3]];
  return (
    <svg className="chronicles-sheet-grimoire__spell-icon" viewBox="0 0 24 24"
      width="32" height="32" shapeRendering="crispEdges" aria-hidden="true"
      focusable="false" data-spell-icon={ART[id] ? id : 'fallback'}>
      <path d={icon[0]} fill={palette[0]} />
      <path d={icon[1]} fill={palette[1]} />
      <path d={icon[2]} fill={palette[2]} />
    </svg>
  );
}
