import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chroniclesMapContentPosition,
  chroniclesMapForState,
} from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesDiscoveredPois, chroniclesRouteTargetOverlapsPoi } from '../chronicles/chroniclesAutomapPoi.js';
import { chroniclesRegionHudLocation } from '../chronicles/chroniclesRegionHud.js';
import {
  chroniclesAutomapCellKey,
  chroniclesAutomapFacingDegrees,
  chroniclesAutomapTouchedCells,
  chroniclesAutomapRevealedCells,
  chroniclesMapCoordinatesLabel,
} from '../chronicles/chroniclesAutomap.js';

export const CHRONICLES_MINIMAP_RADIUS = 3;

const MINIMAP_ACCESSIBLE_BASE = 'Minimapa local. Abrir automapa completo';

// The minimap is one focusable button: describe only POIs already shown by
// its discovery-gated local viewport. Keep speech brief in crowded towns.
export function chroniclesMinimapAccessibleLabel(markers, target = null, routeLabel = '') {
  const route = target ? `★: rumbo al objetivo${routeLabel ? `, siguiente salida: ${routeLabel}` : ''}. ` : '';
  if (!Array.isArray(markers) || markers.length === 0) {
    return route ? `Minimapa local. ${route}Abrir automapa completo` : MINIMAP_ACCESSIBLE_BASE;
  }
  const first = markers.slice(0, 3).map((marker) => `${marker.glyph}: ${marker.label}`);
  const remaining = markers.length - first.length;
  return `Minimapa local. Lugares descubiertos: ${first.join('; ')}${remaining ? `; y ${remaining} más` : ''}. ${route}Abrir automapa completo`;
}



// Rows stay at 2·radius+1; columns grow with the frame's width so the known
// map fills the whole black area instead of a square in the middle of it.
export function chroniclesMinimapRadiusX(radius, aspect) {
  const ratio = Number(aspect);
  if (!Number.isFinite(ratio) || ratio <= 1) return radius;
  return Math.max(radius, Math.ceil(((2 * radius + 1) * ratio - 1) / 2));
}

function inWindow(position, state, radiusX, radiusY = radiusX) {
  return Boolean(
    position
    && Math.abs(position.x - state.x) <= radiusX
    && Math.abs(position.y - state.y) <= radiusY
  );
}

// Use the same authored, deduplicated, discovery-gated POIs as the full M map.
// Only their presentation and seven-tile viewport are different.
function discoveredLocalMarkers(map, state, revealed, radiusX, radiusY) {
  return chroniclesDiscoveredPois(map, revealed, chroniclesMapContentPosition)
    .filter((marker) => inWindow(marker.position, state, radiusX, radiusY));
}

function Marker({ marker }) {
  const { x, y } = marker.position;
  return (
    <g className={`chronicles-minimap__poi is-${marker.category}`}
      data-chronicles-poi={marker.category}
      data-chronicles-poi-id={marker.id}
      aria-label={marker.label}
      pointerEvents="none">
      <title>{marker.label}</title>
      <rect x={x + .08} y={y + .08} width=".84" height=".84" rx=".12" />
      <text x={x + .5} y={y + .54} textAnchor="middle" dominantBaseline="middle">{marker.glyph}</text>
    </g>
  );
}

// The next step towards the objective: a star when it is in view, or an
// arrow on the rim of the minimap pointing the way when it is not.
function TargetMarker({ target, state, radiusX, radiusY, overlapsPoi = false }) {
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const overlapsParty = target.x === state.x && target.y === state.y;
  const cornerBadge = overlapsPoi || overlapsParty;
  if (Math.abs(dx) <= radiusX && Math.abs(dy) <= radiusY) {
    return (
      <g className={`chronicles-minimap__target${cornerBadge ? ' is-corner-badge' : ''}`}
        data-chronicles-route-target="in-view"
        data-chronicles-route-overlap={overlapsPoi ? 'poi' : (overlapsParty ? 'party' : undefined)}>
        <circle cx={target.x + (cornerBadge ? .78 : .5)}
          cy={target.y + (cornerBadge ? .78 : .5)} r={cornerBadge ? .21 : .42} />
        <text x={target.x + (cornerBadge ? .78 : .5)}
          y={target.y + (cornerBadge ? .81 : .56)}
          textAnchor="middle" dominantBaseline="middle">★</text>
      </g>
    );
  }
  const scale = Math.min(
    dx ? (radiusX + .1) / Math.abs(dx) : Infinity,
    dy ? (radiusY + .1) / Math.abs(dy) : Infinity,
  );
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
  routeLabel = '',
}) {
  const map = chroniclesMapForState(state);
  const svgRef = useRef(null);
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) setAspect(width / height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hidden, Boolean(state && map)]);
  const radiusX = chroniclesMinimapRadiusX(radius, aspect);
  const radiusY = radius;
  const visited = useMemo(
    () => new Set(Array.isArray(visitedCells) ? visitedCells : []),
    [visitedCells],
  );
  const discovered = useMemo(
    () => chroniclesAutomapRevealedCells(map, Array.from(visited)),
    [map, visited],
  );
  const localVisible = useMemo(
    () => chroniclesAutomapTouchedCells(map, state),
    [map, state?.x, state?.y],
  );
  const revealed = useMemo(
    () => new Set([...discovered, ...localVisible]),
    [discovered, localVisible],
  );

  if (hidden || !state || !map) return null;

  const width = radiusX * 2 + 1;
  const height = radiusY * 2 + 1;
  const minX = state.x - radiusX;
  const minY = state.y - radiusY;
  const cx = state.x + .5;
  const cy = state.y + .5;
  const facing = chroniclesAutomapFacingDegrees(state.direction);
  const markers = discoveredLocalMarkers(map, state, revealed, radiusX, radiusY);
  const coordinates = chroniclesMapCoordinatesLabel(map, state) || 'LOCAL';
  const region = chroniclesRegionHudLocation(map);
  const locationText = region.kind.startsWith('ÁREA ') ? `${region.kind} · ${region.value}` : region.value;

  return (
    <button
      type="button"
      className="chronicles-minimap"
      data-chronicles-minimap="visible"
      aria-label={`${chroniclesMinimapAccessibleLabel(markers, target, routeLabel)}. Ubicación: ${locationText}. Coordenadas: ${coordinates}`}
      onClick={onExpand}
    >
      <span className="chronicles-minimap__title" aria-hidden="true" data-chronicles-coordinates>{coordinates}</span>
      <span className="chronicles-minimap__location" aria-hidden="true" data-chronicles-location>UBICACIÓN · {locationText}</span>
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
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
          if (Math.abs(x - state.x) > radiusX || Math.abs(y - state.y) > radiusY) return null;
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
            key={marker.id}
            marker={marker}
          />
        ))}
        {target && <TargetMarker target={target} state={state} radiusX={radiusX} radiusY={radiusY}
          overlapsPoi={chroniclesRouteTargetOverlapsPoi(target, markers)} />}
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
