import { useEffect, useMemo, useRef, useState } from 'react';
import { TERRA_COLUMNS, chroniclesWorldMapModel } from '../chronicles/chroniclesWorldMap.js';
import {
  chroniclesMapContentPosition,
  chroniclesMapForState,
} from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesDiscoveredPois, chroniclesRouteTargetOverlapsPoi } from '../chronicles/chroniclesAutomapPoi.js';
import { chroniclesPartyHotkeyMember } from '../chronicles/chroniclesKeyboardBindings.js';
import {
  chroniclesAutomapCellKey,
  chroniclesAutomapFacingDegrees,
  chroniclesAutomapRevealedCells,
  chroniclesMapCoordinatesLabel,
} from '../chronicles/chroniclesAutomap.js';

function automapViewport(revealed, state) {
  const points = [...revealed].map((key) => {
    const [x, y] = String(key).split(':').map(Number);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }).filter(Boolean);

  if (!points.length && state) points.push({ x: state.x, y: state.y });

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  const contentWidth = Math.max(1, maxX - minX + 1);
  const contentHeight = Math.max(1, maxY - minY + 1);
  const width = Math.max(5.2, contentWidth + 1.2);
  const height = Math.max(5.2, contentHeight + 1.2);
  const centerX = (minX + maxX + 1) / 2;
  const centerY = (minY + maxY + 1) / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function MapMarker({ marker }) {
  const { x, y } = marker.position;
  return (
    <g className={`chronicles-automap__poi is-${marker.category}`}
      data-chronicles-poi={marker.category}
      data-chronicles-poi-id={marker.id}
      aria-label={marker.label}>
      <title>{marker.label}</title>
      <rect x={x + 0.12} y={y + 0.12} width="0.76" height="0.76" rx="0.13" />
      <text x={x + 0.5} y={y + 0.53} textAnchor="middle" dominantBaseline="middle">{marker.glyph}</text>
    </g>
  );
}

const BIOME_LABELS = Object.freeze({
  plains: 'llanura', hills: 'colinas', marsh: 'marisma', coast: 'costa', snow: 'nieve', ash: 'ceniza', forest: 'bosque',
});

// Terra, 6×6: seen areas by name, towns always (travellers know them),
// dungeons once their area has been walked, the party and the objective.
function WorldView({ model }) {
  return (
    <div className="chronicles-worldmap" data-chronicles-worldmap="open">
      <div className="chronicles-worldmap__grid" role="grid" aria-label="Mapa de Terra">
        <span className="chronicles-worldmap__corner" aria-hidden="true" />
        {TERRA_COLUMNS.map((column) => <span key={column} className="chronicles-worldmap__axis" aria-hidden="true">{column}</span>)}
        {model.cells.map((cell, index) => (
          <FragmentRow key={cell.code} index={index} row={cell.code.slice(1)}>
            <div
              role="gridcell"
              className={[
                'chronicles-worldmap__cell',
                cell.visited ? 'is-visited' : 'is-unknown',
                cell.here ? 'is-here' : '',
                cell.target ? 'is-target' : '',
                cell.biome ? `is-${cell.biome}` : '',
              ].join(' ')}
              data-chronicles-world-cell={cell.code}
              aria-label={[
                cell.code, cell.title, cell.here && 'estás aquí', cell.target && 'objetivo',
                ...cell.towns, ...cell.dungeons,
              ].filter(Boolean).join(' · ')}
            >
              <b>{cell.code}</b>
              {cell.title && <small>{cell.title}</small>}
              {!cell.title && cell.biome && <small className="is-faint">{BIOME_LABELS[cell.biome] || ''}</small>}
              <span className="chronicles-worldmap__icons" aria-hidden="true">
                {cell.towns.length > 0 && <i className="is-town" title={cell.towns.join(', ')}>⌂</i>}
                {cell.dungeons.length > 0 && <i className="is-dungeon" title={cell.dungeons.join(', ')}>↓</i>}
                {cell.target && <i className="is-target">★</i>}
                {cell.here && <i className="is-here">▲</i>}
              </span>
            </div>
          </FragmentRow>
        ))}
      </div>
      {model.destination && (
        <p className="chronicles-worldmap__target">★ Objetivo: <b>{model.destination.title}</b> ({model.destination.code})</p>
      )}
    </div>
  );
}

// Each Terra row starts with its number on the axis.
function FragmentRow({ index, row, children }) {
  return (
    <>
      {index % 6 === 0 && <span className="chronicles-worldmap__axis" aria-hidden="true">{row}</span>}
      {children}
    </>
  );
}

export default function ChroniclesAutomap({
  open, state, visitedCells, onClose, onOpenSheet = null,
  target = null, routeLabel = '', visitedMapIds = [], objective = '',
}) {
  const closeRef = useRef(null);
  const [view, setView] = useState('area');
  const worldModel = useMemo(
    () => (view === 'world' ? chroniclesWorldMapModel({ state, visitedMapIds, objective }) : null),
    [view, state, visitedMapIds, objective],
  );
  const map = chroniclesMapForState(state);
  const visited = useMemo(() => {
    const next = new Set(Array.isArray(visitedCells) ? visitedCells : []);
    if (state?.mapId && Number.isInteger(state.x) && Number.isInteger(state.y)) {
      next.add(chroniclesAutomapCellKey(state.x, state.y));
    }
    return next;
  }, [state?.mapId, state?.x, state?.y, visitedCells]);
  const revealed = useMemo(
    () => chroniclesAutomapRevealedCells(map, Array.from(visited)),
    [map, visited],
  );
  const viewport = useMemo(() => automapViewport(revealed, state), [revealed, state]);
  const markers = useMemo(() => chroniclesDiscoveredPois(map, revealed, chroniclesMapContentPosition), [map, revealed]);
  const targetOverPoi = chroniclesRouteTargetOverlapsPoi(target, markers);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open || !state || !map) return null;

  const facing = chroniclesAutomapFacingDegrees(state.direction);
  const cx = state.x + 0.5;
  const cy = state.y + 0.5;

  return (
    <div
      id="chronicles-automap"
      className="chronicles-automap"
      data-chronicles-automap="open"
      role="dialog"
      aria-modal="true"
      aria-label="Automapa de Chronicles"
      onKeyDown={(event) => {
        // Inspecting a hero closes the map before opening the dossier.
        // Consume this key inside the modal so it cannot also select a
        // fighter or execute a double-tap in the hidden 3D world.
        const hero = onOpenSheet && chroniclesPartyHotkeyMember(event, state.party);
        if (!hero) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenSheet(hero.id);
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section className="chronicles-automap__panel">
        <header>
          <div>
            <span data-chronicles-coordinates>AUTOMAPA · {[map.areaCode, chroniclesMapCoordinatesLabel(map, state)].filter(Boolean).join(' · ') || 'EXPLORACIÓN'}</span>
            <strong>{map.title || 'Chronicles of Matthias'}</strong>
          </div>
          <div className="chronicles-automap__tabs" role="tablist" aria-label="Vista del mapa">
            <button type="button" role="tab" aria-selected={view === 'area'} className={view === 'area' ? 'is-active' : ''}
              onClick={() => setView('area')}>Zona</button>
            <button type="button" role="tab" aria-selected={view === 'world'} className={view === 'world' ? 'is-active' : ''}
              data-chronicles-world-tab onClick={() => setView('world')}>Terra</button>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar automapa">×</button>
        </header>

        {view === 'world' && worldModel && <WorldView model={worldModel} />}
        <div className="chronicles-automap__canvas" hidden={view === 'world'}>
          <svg
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            role="img"
            aria-label={`Mapa explorado de ${map.title || 'la zona'}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="chronicles-automap-wall-hatch" patternUnits="userSpaceOnUse" width=".24" height=".24">
                <path d="M -.08 .08 L .08 -.08 M 0 .24 L .24 0 M .16 .32 L .32 .16"
                  stroke="#ae8d70" strokeWidth=".045" opacity=".54" fill="none" />
              </pattern>
            </defs>
            {map.grid.flatMap((row, y) => Array.from(row).map((tile, x) => {
              const key = chroniclesAutomapCellKey(x, y);
              if (!revealed.has(key)) return null;
              const wall = tile === '#';
              return (
                <g key={key}>
                  <rect
                    x={x + 0.03}
                    y={y + 0.03}
                    width="0.94"
                    height="0.94"
                    rx="0.07"
                    className={`chronicles-automap__cell ${wall ? 'is-wall' : 'is-floor'} ${visited.has(key) ? 'is-visited' : ''}`}
                  />
                  {wall && <rect x={x + 0.09} y={y + 0.09} width="0.82" height="0.82"
                    rx="0.03" fill="url(#chronicles-automap-wall-hatch)" pointerEvents="none" />}
                </g>
              );
            }))}
            {markers.map((marker) => (
              <MapMarker
                key={marker.id}
                marker={marker}
              />
            ))}
            {target && (
              <g className={`chronicles-automap__target${targetOverPoi ? ' is-poi-overlap' : ''}`}
                data-chronicles-route-target
                data-chronicles-route-overlap={targetOverPoi ? 'poi' : undefined}
                aria-label={routeLabel ? `Siguiente salida hacia el objetivo: ${routeLabel}` : 'Siguiente paso hacia el objetivo'}>
                {routeLabel && <title>{`Siguiente salida: ${routeLabel}`}</title>}
                <circle cx={target.x + (targetOverPoi ? 0.78 : 0.5)}
                  cy={target.y + (targetOverPoi ? 0.78 : 0.5)} r={targetOverPoi ? 0.21 : 0.46} />
                <text x={target.x + (targetOverPoi ? 0.78 : 0.5)}
                  y={target.y + (targetOverPoi ? 0.81 : 0.55)}
                  textAnchor="middle" dominantBaseline="middle">★</text>
              </g>
            )}
            <g
              className="chronicles-automap__party-marker"
              data-chronicles-map-facing={state.direction}
              transform={`rotate(${facing} ${cx} ${cy})`}
              aria-label="Posición y orientación del grupo"
            >
              <path d={`M ${cx} ${cy - 0.42} L ${cx + 0.3} ${cy + 0.31} L ${cx} ${cy + 0.16} L ${cx - 0.3} ${cy + 0.31} Z`} />
              <circle cx={cx} cy={cy + 0.12} r="0.08" />
            </g>
          </svg>
        </div>

        <footer>
          <span><i className="is-party" aria-hidden="true">▲</i> grupo</span>
          <span><i className="is-exit" aria-hidden="true">↗</i> salida · ↓ mazmorra</span>
          <span className="chronicles-automap__legend-guild"><i aria-hidden="true">G</i> gremio</span>
          <span>F forja · A armaduras · P posada · C comercio · T templo · H ayuntamiento</span>
          <span><i className="is-target" aria-hidden="true">★</i> rumbo al objetivo{target && routeLabel && <> · salida: <b className="chronicles-automap__route-label" title={routeLabel}>{routeLabel}</b></>} · Solo lugares descubiertos · {onOpenSheet && <><kbd>1–4</kbd> fichas · </>}<kbd>M</kbd> cerrar</span>
        </footer>
      </section>
    </div>
  );
}
