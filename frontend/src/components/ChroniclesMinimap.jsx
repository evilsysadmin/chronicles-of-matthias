import { useMemo } from 'react';
import {
  chroniclesMapContentPosition,
  chroniclesMapForState,
} from '../chronicles/chroniclesMapCatalog.js';
import {
  chroniclesAutomapCellKey,
  chroniclesAutomapFacingDegrees,
  chroniclesAutomapLocalVisibleCells,
  chroniclesAutomapRevealedCells,
  chroniclesMapCoordinatesLabel,
} from '../chronicles/chroniclesAutomap.js';

export const CHRONICLES_MINIMAP_RADIUS = 3;

function inWindow(position, state, radius) {
  return Boolean(
    position
    && Math.abs(position.x - state.x) <= radius
    && Math.abs(position.y - state.y) <= radius
  );
}

function discoveredLocalMarkers(map, state, revealed, radius) {
  const groups = [
    ['exit', map?.exits || []],
    ['treasure', map?.treasures || []],
    ['interactable', map?.interactables || []],
  ];

  return groups.flatMap(([kind, entries]) => entries.flatMap((entry) => {
    const position = chroniclesMapContentPosition(map, entry);
    if (!inWindow(position, state, radius)) return [];
    if (!revealed.has(chroniclesAutomapCellKey(position.x, position.y))) return [];
    return [{ kind, entry, position }];
  }));
}

function Marker({ marker }) {
  const { x, y } = marker.position;
  if (marker.kind === 'exit') {
    return (
      <rect
        className="chronicles-minimap__marker is-exit"
        x={x + .27}
        y={y + .27}
        width=".46"
        height=".46"
        rx=".08"
      />
    );
  }
  if (marker.kind === 'treasure') {
    return (
      <path
        className="chronicles-minimap__marker is-treasure"
        d={`M ${x + .5} ${y + .27} L ${x + .73} ${y + .5} L ${x + .5} ${y + .73} L ${x + .27} ${y + .5} Z`}
      />
    );
  }
  return (
    <circle
      className="chronicles-minimap__marker is-interactable"
      cx={x + .5}
      cy={y + .5}
      r=".17"
    />
  );
}

// The next step towards the objective: a star when it is in view, or an
// arrow on the rim of the minimap pointing the way when it is not.
function TargetMarker({ target, state, radius }) {
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
    return (
      <g className="chronicles-minimap__target" data-chronicles-route-target="in-view">
        <circle cx={target.x + .5} cy={target.y + .5} r=".42" />
        <text x={target.x + .5} y={target.y + .56} textAnchor="middle" dominantBaseline="middle">★</text>
      </g>
    );
  }
  const scale = (radius + .1) / Math.max(Math.abs(dx), Math.abs(dy));
  const ex = state.x + .5 + dx * scale;
  const ey = state.y + .5 + dy * scale;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g className="chronicles-minimap__target is-offscreen" data-chronicles-route-target="edge"
      transform={`rotate(${angle} ${ex} ${ey})`}>
      <path d={`M ${ex + .32} ${ey} L ${ex - .22} ${ey - .26} L ${ex - .1} ${ey} L ${ex - .22} ${ey + .26} Z`} />
    </g>
  );
}

export default function ChroniclesMinimap({
  state,
  visitedCells,
  hidden = false,
  radius = CHRONICLES_MINIMAP_RADIUS,
  onExpand,
  target = null,
}) {
  const map = chroniclesMapForState(state);
  const visited = useMemo(
    () => new Set(Array.isArray(visitedCells) ? visitedCells : []),
    [visitedCells],
  );
  const discovered = useMemo(
    () => chroniclesAutomapRevealedCells(map, Array.from(visited)),
    [map, visited],
  );
  const localVisible = useMemo(
    () => chroniclesAutomapLocalVisibleCells(map, state, radius),
    [map, radius, state?.x, state?.y],
  );
  const revealed = useMemo(
    () => new Set([...discovered, ...localVisible]),
    [discovered, localVisible],
  );

  if (hidden || !state || !map) return null;

  const size = radius * 2 + 1;
  const minX = state.x - radius;
  const minY = state.y - radius;
  const cx = state.x + .5;
  const cy = state.y + .5;
  const facing = chroniclesAutomapFacingDegrees(state.direction);
  const markers = discoveredLocalMarkers(map, state, discovered, radius);

  return (
    <button
      type="button"
      className="chronicles-minimap"
      data-chronicles-minimap="visible"
      aria-label="Minimapa local. Abrir automapa completo"
      onClick={onExpand}
    >
      <span className="chronicles-minimap__title" aria-hidden="true" data-chronicles-coordinates>{chroniclesMapCoordinatesLabel(map, state) || 'LOCAL'}</span>
      <svg
        viewBox={`${minX} ${minY} ${size} ${size}`}
        role="img"
        aria-label={`Entorno explorado en un radio de ${radius} casillas`}
      >
        <defs>
          <pattern id="chronicles-minimap-wall-hatch" patternUnits="userSpaceOnUse" width=".24" height=".24">
            <path d="M -.08 .08 L .08 -.08 M 0 .24 L .24 0 M .16 .32 L .32 .16"
              stroke="#ae8d70" strokeWidth=".045" opacity=".54" fill="none" />
          </pattern>
        </defs>
        {map.grid.flatMap((row, y) => Array.from(row).map((tile, x) => {
          if (Math.abs(x - state.x) > radius || Math.abs(y - state.y) > radius) return null;
          const key = chroniclesAutomapCellKey(x, y);
          if (!revealed.has(key)) return null;
          return (
            <g key={key}>
              <rect
                x={x + .04}
                y={y + .04}
                width=".92"
                height=".92"
                rx=".08"
                className={`chronicles-minimap__cell ${tile === '#' ? 'is-wall' : 'is-floor'} ${visited.has(key) ? 'is-visited' : ''}`}
              />
              {tile === '#' && <rect x={x + .09} y={y + .09} width=".82" height=".82"
                rx=".03" fill="url(#chronicles-minimap-wall-hatch)" pointerEvents="none" />}
            </g>
          );
        }))}
        {markers.map((marker) => (
          <Marker
            key={`${marker.kind}:${marker.entry?.id || `${marker.position.x}:${marker.position.y}`}`}
            marker={marker}
          />
        ))}
        {target && <TargetMarker target={target} state={state} radius={radius} />}
        <g
          className="chronicles-minimap__party"
          transform={`rotate(${facing} ${cx} ${cy})`}
          data-chronicles-minimap-facing={state.direction}
        >
          <path d={`M ${cx} ${cy - .38} L ${cx + .28} ${cy + .26} L ${cx} ${cy + .12} L ${cx - .28} ${cy + .26} Z`} />
        </g>
      </svg>
      <span className="chronicles-minimap__expand" aria-hidden="true">⌖</span>
    </button>
  );
}
