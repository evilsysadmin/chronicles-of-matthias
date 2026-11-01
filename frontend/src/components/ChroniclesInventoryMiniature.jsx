import { useId } from 'react';
import { CHRONICLES_EQUIPMENT } from '../chronicles/chroniclesEquipment.js';

// Hand-authored 48px inventory miniatures. Unlike the large shop portraits,
// these shapes remain distinct at 28px. Only real catalog metadata drives art.
// The material palette applies to the metalwork, not to wooden grips/shafts.
const METALS = Object.freeze({
  brass: ['#f9db99', '#ae793b', '#684027'],
  bronze: ['#ffdda4', '#ad6c39', '#673b29'],
  iron: ['#d6d9d2', '#7a8586', '#434b50'],
  silver: ['#fff8e9', '#b9c8d3', '#6b8191'],
  steel: ['#f1f4ef', '#95abb6', '#43596a'],
  ivory: ['#fff5d4', '#d8c69d', '#8c7857'],
  wooden: ['#c8c8b8', '#83918a', '#505e58'],
  leather: ['#d3a275', '#85573b', '#4b3129'],
});
const WOOD = Object.freeze(['#dcad74', '#885a3a', '#3d3028']);
const FAMILIES = new Set(['dagger', 'staff', 'mace', 'spear', 'sword', 'axe', 'bow', 'longbow', 'crossbow', 'sling', 'shield']);
const ARMOR_TYPES = new Set(['padded', 'leather', 'scale', 'ring', 'chain', 'splint', 'plate']);

export function chroniclesInventoryMiniatureSpec(item) {
  const gear = CHRONICLES_EQUIPMENT[item?.id] || (item?.materialId && item?.slot ? item : null);
  if (!gear) return null;
  const family = gear.slot === 'shield' ? 'shield'
    : gear.slot === 'armor' ? gear.armorType || gear.baseItemId
      : gear.baseItemId === 'longbow' ? 'longbow'
        : gear.weaponFamily || gear.baseItemId;
  if (!FAMILIES.has(family) && !(gear.slot === 'armor' && ARMOR_TYPES.has(family))) return null;
  const material = Object.hasOwn(METALS, gear.materialId) ? gear.materialId : 'iron';
  return { family, material };
}

const outline = '#39342e';

function Weapon({ family, material, metal, wood, light }) {
  switch (family) {
    case 'dagger':
    case 'sword':
      return (
        <g transform={family === 'sword' ? 'rotate(34 24 24)' : 'rotate(30 24 24)'} stroke={outline} strokeLinejoin="round">
          <path d={family === 'sword' ? 'M24 3 29 13 28 30 24 34 20 30 19 13Z' : 'M24 10 29 19 27 29 24 32 21 29 19 19Z'}
            fill={metal} strokeWidth="1.4" />
          <path d={family === 'sword' ? 'M24 5V31' : 'M24 12V30'} stroke={light} strokeWidth="1.3" opacity=".86" />
          <path d="M15 31Q24 27 33 31L34 34Q25 33 24 36 20 33 14 34Z"
            fill={metal} strokeWidth="1.5" />
          <path d="M22 34h4v9h-4z" fill={wood} strokeWidth="1.3" />
          <path d="M22 38h4m-4 3h4" stroke={light} strokeWidth="1" opacity=".6" />
          <path d="m20 43 4-2 4 2-2 3h-4z" fill={metal} strokeWidth="1.4" />
        </g>
      );
    case 'mace':
      return (
        <g stroke={outline} strokeLinejoin="round">
          <path d="m22 21 4 0 1 22-6 0z" fill={wood} strokeWidth="1.6" />
          <path d="M21 35h6v4h-6zM20 42h8l-2 4h-4z" fill={metal} strokeWidth="1.3" />
          <path d="M17 9 22 5h6l4 4 3 5-3 9-8 4-8-4-3-9Z" fill={material === 'wooden' ? wood : metal} strokeWidth="1.7" />
          <path d="m24 5 3 8-3 14-4-14ZM14 14h20M18 22l12-1" fill="none"
            stroke={light} strokeWidth="2" opacity=".75" />
          <path d="m17 10-5 2v7l5 2m14-11 5 2v7l-5 2" fill="none" stroke={outline} strokeWidth="2" />
          <circle cx="24" cy="15" r="2" fill={light} />
        </g>
      );
    case 'axe':
      return (
        <g transform="rotate(19 24 24)" stroke={outline} strokeLinejoin="round">
          <path d="M22 7h5v38h-5z" fill={wood} strokeWidth="1.5" />
          <path d="M22 11Q15 3 7 9l-3 12q7 0 13 11l5-5Z" fill={metal} strokeWidth="1.8" />
          <path d="M8 11 6 20Q14 20 18 28M12 10l5 7" stroke={light} strokeWidth="1.8" fill="none" opacity=".8" />
          <path d="M22 34h5v4h-5z" fill={metal} strokeWidth="1.2" />
        </g>
      );
    case 'spear':
      return (
        <g transform="rotate(27 24 24)" stroke={outline} strokeLinejoin="round">
          <path d="M22 16h4v29h-4z" fill={wood} strokeWidth="1.4" />
          <path d="M24 2 31 17 24 23 17 17Z" fill={metal} strokeWidth="1.7" />
          <path d="M24 3v17m-5-5 5 5 5-5" fill="none" stroke={light} strokeWidth="1.6" opacity=".85" />
          <path d="M21 23h6v6h-6z" fill={metal} strokeWidth="1.2" />
          <path d="M22 34h4m-4 4h4" stroke={light} strokeWidth="1.2" opacity=".7" />
        </g>
      );
    case 'staff':
      return (
        <g transform="rotate(24 24 24)" stroke={outline} strokeLinejoin="round">
          <path d="M21 8Q18 19 21 28L20 45h6l1-18q-4-12 0-19Z" fill={material === 'ivory' ? metal : wood} strokeWidth="1.7" />
          <path d="M18 11Q17 3 24 3q8 0 7 8l-5 5-6-2Z" fill={material === 'ivory' ? metal : wood} strokeWidth="1.6" />
          <path d="M24 4q-5 7 2 10m-4 10 3 5-3 6" fill="none" stroke={light} strokeWidth="1.5" opacity=".8" />
          <path d="M21 17h6v3h-6zM20 39h7v3h-7z" fill={metal} strokeWidth="1.2" />
        </g>
      );
    case 'bow':
    case 'longbow':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d={family === 'longbow' ? 'M20 2Q-2 24 20 46' : 'M17 6Q-1 24 17 42'}
            fill="none" stroke={outline} strokeWidth="6" />
          <path d={family === 'longbow' ? 'M20 2Q-2 24 20 46' : 'M17 6Q-1 24 17 42'}
            fill="none" stroke={wood} strokeWidth="3.6" />
          <path d={family === 'longbow' ? 'M20 2 29 24 20 46' : 'M17 6 26 24 17 42'}
            fill="none" stroke="#ded4ac" strokeWidth="1.3" />
          <path d="M7 22h33l-7-4m7 4-7 4" fill="none" stroke={metal} strokeWidth="2.2" />
          <path d="M22 19v6" stroke={light} strokeWidth="1.2" />
          <path d="m9 20 2-2m-2 8 2 2" stroke={outline} strokeWidth="2" />
        </g>
      );
    case 'crossbow':
      return (
        <g stroke={outline} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 13Q24 26 40 13" fill="none" stroke={metal} strokeWidth="5" />
          <path d="M8 13 24 20 40 13" stroke="#ddd0ad" strokeWidth="1.4" fill="none" />
          <path d="M21 11h6v34h-6z" fill={wood} strokeWidth="1.7" />
          <path d="M21 11h6v9h-6z" fill={metal} strokeWidth="1.3" />
          <path d="M24 5v27m-4-23 4-4 4 4" fill="none" stroke={light} strokeWidth="1.5" />
          <path d="M24 28q10 3 4 9m-7 3h6" fill="none" stroke={metal} strokeWidth="2.8" />
        </g>
      );
    case 'sling':
      return (
        <g stroke={outline} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 7Q15 16 19 30M39 7Q33 16 29 30" fill="none" stroke={wood} strokeWidth="3.2" />
          <path d="M9 7Q15 16 19 30M39 7Q33 16 29 30" fill="none" stroke={light} strokeWidth="1" opacity=".7" />
          <path d="M15 28q9-6 18 0l-3 10q-6 5-12 0Z" fill={wood} strokeWidth="1.6" />
          <circle cx="24" cy="32" r="4.5" fill={metal} strokeWidth="1.2" />
          <path d="M20 38q4 3 8 0" stroke={light} strokeWidth="1.2" />
          <path d="M8 6h4m24 0h4" stroke={metal} strokeWidth="2" />
        </g>
      );
    case 'shield':
      return (
        <g stroke={outline} strokeLinejoin="round">
          <path d="M9 5Q24 0 39 5v19Q36 36 24 45 12 36 9 24Z" fill={metal} strokeWidth="2" />
          <path d="M14 10q10-4 20 0v15Q32 32 24 39 16 32 14 25Z" fill={wood} strokeWidth="1.6" />
          <path d="M24 7v33M13 19h22" stroke={light} strokeWidth="1.6" opacity=".8" />
          <circle cx="24" cy="23" r="6.5" fill={metal} strokeWidth="1.7" />
          <circle cx="22" cy="21" r="1.8" fill={light} opacity=".9" />
          <circle cx="14" cy="12" r="1.2" fill={light} />
          <circle cx="34" cy="12" r="1.2" fill={light} />
        </g>
      );
    default:
      return null;
  }
}

function Armor({ family, material, metal, wood, light }) {
  // Bronze/iron/steel cuirasses use plated metal even in the leather-shaped cut.
  // Only actual leather is dyed hide; do not paint steel equipment brown.
  const soft = material === 'leather';
  return (
    <g stroke={outline} strokeLinejoin="round">
      <path d="M14 6 5 13 3 24 13 28 16 21v21q8 5 16 0V21l3 7 10-4-2-11-9-7-5 5H19Z"
        fill={soft ? wood : metal} strokeWidth="1.9" />
      <path d="M16 13q8 7 16 0L30 40q-6 4-12 0Z"
        fill={soft ? wood : metal} strokeWidth="1.2" />
      <path d="M19 6q5 6 10 0l-2 10h-6Z" fill={soft ? '#513b2f' : '#526168'} strokeWidth="1.5" />
      <path d="M16 13q8 6 16 0M16 24h16M17 35h15" stroke={light} strokeWidth="1.4" opacity=".7" fill="none" />
      {family === 'padded' && <g stroke={light} opacity=".65" strokeWidth="1.4"><path d="M18 17 30 33M17 25l10 13M30 18 18 33" /></g>}
      {family === 'leather' && <g fill={metal} strokeWidth=".9"><circle cx="17" cy="20" r="1.5"/><circle cx="31" cy="20" r="1.5"/><path d="M17 29h14v3H17z"/></g>}
      {(family === 'ring' || family === 'chain') && (
        <g fill="none" stroke={light} strokeWidth="1.7" opacity=".88">
          <circle cx="20" cy="20" r="2.2"/><circle cx="26" cy="20" r="2.2"/><circle cx="23" cy="26" r="2.2"/>
          <circle cx="29" cy="26" r="2.2"/><circle cx="20" cy="32" r="2.2"/><circle cx="26" cy="32" r="2.2"/>
          {family === 'chain' && <path d="M18 23h14M18 29h14M18 35h14" />}
        </g>
      )}
      {family === 'scale' && (
        <g fill="none" stroke={light} strokeWidth="1.7" opacity=".85">
          <path d="M17 18q4 7 8 0t8 0M17 24q4 7 8 0t8 0M17 30q4 7 8 0t8 0"/>
        </g>
      )}
      {family === 'splint' && <g fill="none" stroke={light} strokeWidth="2"><path d="M20 17v22m8-22v22m-11-13h14"/></g>}
      {family === 'plate' && (
        <g strokeWidth="1.2">
          <path d="M19 18 24 21l5-3v13l-5 5-5-5Z" fill={metal}/>
          <path d="M24 21v15M18 34h12" fill="none" stroke={light} strokeWidth="1.8" />
        </g>
      )}
      <path d="M14 33h20v4H14z" fill={soft ? '#65432f' : metal} strokeWidth="1.2"/>
      <rect x="22" y="32.7" width="4" height="4.5" rx=".8" fill={light} strokeWidth=".8" />
      <path d="M7 15 5 23l8 2m28-10 2 8-8 2" fill="none" stroke={light} strokeWidth="1.5" opacity=".75" />
    </g>
  );
}

export default function ChroniclesInventoryMiniature({ item, spec = chroniclesInventoryMiniatureSpec(item), kind }) {
  const baseId = useId().replace(/:/g, '');
  if (!spec) return null;
  const tones = METALS[spec.material];
  const mid = 'chronicles-mini-metal-' + baseId;
  const wid = 'chronicles-mini-wood-' + baseId;
  const metal = 'url(#' + mid + ')';
  const wood = 'url(#' + wid + ')';
  return (
    <svg className="chronicles-character-sheet__illustrated-item-icon chronicles-character-sheet__inventory-miniature"
      viewBox="0 0 48 48" width="29" height="29" aria-hidden="true" focusable="false"
      data-item-icon={kind} data-illustration-family={spec.family} data-illustration-material={spec.material}>
      <defs>
        <linearGradient id={mid} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={tones[0]} /><stop offset=".43" stopColor={tones[1]} /><stop offset="1" stopColor={tones[2]} />
        </linearGradient>
        <linearGradient id={wid} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={WOOD[0]} /><stop offset=".42" stopColor={WOOD[1]} /><stop offset="1" stopColor={WOOD[2]} />
        </linearGradient>
      </defs>
      {ARMOR_TYPES.has(spec.family)
        ? <Armor family={spec.family} material={spec.material} metal={metal} wood={wood} light={tones[0]} />
        : <Weapon family={spec.family} material={spec.material} metal={metal} wood={wood} light={tones[0]} />}
    </svg>
  );
}
