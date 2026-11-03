// Eight small ORIGINAL pixel-geometry emblems inspired by classic RPG ledgers.
// No extracted game sprites, icon fonts, network assets or runtime dependencies.
// They are decorative: the real attribute name and value remain accessible.
const EMBLEMS = Object.freeze({
  might: (
    <>
      <path d="M6 27V17h5l3-6h4V6h5v8l-3 7-6 6Z" fill="#9b5029" stroke="#432718" strokeWidth="2" />
      <path d="M10 24v-7h5l3-6h2v5l-3 7Z" fill="#edb873" />
      <path d="M15 7h4v6h-4zM20 7h4v7h-4z" fill="#f4ce91" stroke="#432718" strokeWidth="1.5" />
      <path d="M8 20h7M10 23h5" stroke="#61391e" strokeWidth="1.5" />
    </>
  ),
  intellect: (
    <>
      <path d="M3 8h9l4 3 4-3h9v18h-9l-4 2-4-2H3Z" fill="#6a8d9e" stroke="#3c2b22" strokeWidth="2" />
      <path d="M6 10h7l3 3v11l-4-2H6zM19 13l3-3h5v12h-5l-3 2Z" fill="#f4dc9e" />
      <path d="M16 12v14M8 15h5M8 19h5M21 15h4M21 19h4" stroke="#855d3e" strokeWidth="1.5" />
      <rect x="14" y="24" width="4" height="3" fill="#ba7a40" />
    </>
  ),
  personality: (
    <>
      <path d="M7 5h18l3 7-2 12-10 5L6 24 4 12Z" fill="#8c5734" stroke="#392518" strokeWidth="2" />
      <path d="M9 8h14l2 6-2 9-7 3-7-3-2-9Z" fill="#e1b276" />
      <path d="M9 14h6v4H9zM18 14h6v4h-6z" fill="#452c1c" />
      <path d="M12 21l4 2 4-2" fill="none" stroke="#654025" strokeWidth="2" />
      <path d="M8 9l5 2M24 9l-5 2" stroke="#f7e1a0" strokeWidth="2" />
    </>
  ),
  endurance: (
    <>
      <path d="M16 3 28 8v10c0 7-6 10-12 13C10 28 4 25 4 18V8Z" fill="#536b44" stroke="#38291c" strokeWidth="2" />
      <path d="M16 6 25 10v8c0 5-4 7-9 10-5-3-9-5-9-10v-8Z" fill="#b1bf77" />
      <path d="M14 9h4v7h6v4h-6v6h-4v-6H8v-4h6Z" fill="#f3e0a6" stroke="#5c6a42" strokeWidth="1" />
    </>
  ),
  speed: (
    <>
      <path d="M5 24h10l5-7 4 2v4h5v5H6Z" fill="#486d8b" stroke="#34271c" strokeWidth="2" />
      <path d="M9 23h9l3-4 2 1v3h4v2H8Z" fill="#8ec1d0" />
      <path d="M9 20 4 15l8 2-6-6 11 4-2 6Z" fill="#f1e7b7" stroke="#665438" strokeWidth="1.5" />
      <path d="M7 27h21" stroke="#cf8f48" strokeWidth="2" />
    </>
  ),
  accuracy: (
    <>
      <rect x="4" y="4" width="24" height="24" fill="#e8d1a0" stroke="#67472b" strokeWidth="2" />
      <circle cx="16" cy="16" r="10" fill="#a95844" />
      <circle cx="16" cy="16" r="7" fill="#f4e1ba" />
      <circle cx="16" cy="16" r="4" fill="#a95844" />
      <path d="M6 26 23 9M18 9h5v5" fill="none" stroke="#324c39" strokeWidth="2.5" />
      <path d="m23 9 5-5" stroke="#d1bf8b" strokeWidth="2" />
    </>
  ),
  luck: (
    <>
      <path d="M6 7 22 4l6 6-2 16-16 3-6-6Z" fill="#d5bf92" stroke="#3b2d28" strokeWidth="2" />
      <path d="M6 8 21 6v17L8 26 5 22Z" fill="#f6e9bf" />
      <path d="m21 6 5 5-1 13-4-1Z" fill="#a58e75" />
      <g fill="#464036">
        <rect x="10" y="10" width="3" height="3" />
        <rect x="16" y="9" width="3" height="3" />
        <rect x="13" y="15" width="3" height="3" />
        <rect x="9" y="21" width="3" height="3" />
        <rect x="17" y="20" width="3" height="3" />
      </g>
    </>
  ),
  condition: (
    <>
      <path d="M16 28 5 17C-1 10 6 3 12 7l4 4 4-4c6-4 13 3 7 10Z" fill="#9d3935" stroke="#492821" strokeWidth="2" />
      <path d="M16 25 8 17C3 12 8 8 12 11l4 4 4-4c4-3 9 1 4 6Z" fill="#e06d55" />
      <path d="M14 11h4v5h5v4h-5v5h-4v-5H9v-4h5Z" fill="#f8e8be" />
    </>
  ),
});

export const CHRONICLES_CHARACTER_STAT_ICON_IDS = Object.freeze(Object.keys(EMBLEMS));

export default function ChroniclesCharacterStatIcon({ stat }) {
  if (!Object.hasOwn(EMBLEMS, stat)) return null;
  return (
    <i className="chronicles-character-sheet__stat-icon" aria-hidden="true" data-stat-icon={stat}>
      <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"
        shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        {EMBLEMS[stat]}
      </svg>
    </i>
  );
}
