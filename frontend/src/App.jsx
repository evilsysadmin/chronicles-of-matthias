import { useEffect, useState } from 'react';
import ChroniclesCharacterSetup from './components/ChroniclesCharacterSetup.jsx';
import ChroniclesJournalModal from './components/ChroniclesJournalModal.jsx';
import SwordhavenViewport from './components/SwordhavenViewport.jsx';
import SwordhavenMiniMap from './components/SwordhavenMiniMap.jsx';
import { chroniclesPartyPortraitUrl } from './chronicles/chroniclesPartyPortraitAssets.js';
import { createSwordhavenWalkState, swordhavenWalkStep, SWORDHAVEN_DIRECTIONS } from './chronicles/swordhavenWalk.js';
import { CHRONICLES_PARTY } from './chroniclesOfMatthias.js';
import {
  createCanonicalChroniclesCharacterBuild,
  validateChroniclesCharacterBuild,
} from './chronicles/chroniclesCharacterBuilds.js';
import { CHRONICLES_MM3_CLASSES } from './chronicles/chroniclesMM3Rules.js';
import { CRYPT_MAP } from '../../web/game/crypt-map.js';
import {
  DIRECTIONS, activeEnemies, createExplorationState, explorationStep, visibleInteraction,
} from '../../web/game/exploration-core.js';

const FACING = ['↑', '→', '↓', '←'];
const KEY_MOVES = {
  ArrowUp: 'forward', w: 'forward', ArrowDown: 'backward', s: 'backward',
  ArrowLeft: 'turn-left', a: 'turn-left', ArrowRight: 'turn-right', d: 'turn-right',
  q: 'strafe-left', e: 'strafe-right',
};
const COMMANDS = [
  ['turn-left', '↶ Girar'], ['forward', '↑ Avanzar'], ['turn-right', '↷ Girar'],
  ['strafe-left', '← Lateral'], ['backward', '↓ Atrás'], ['strafe-right', '→ Lateral'],
];

const TOWN_CONTROL_ACCESSIBLE = Object.freeze({
  'turn-left': 'Girar a la izquierda',
  'turn-right': 'Girar a la derecha',
  forward: 'Avanzar',
  backward: 'Retroceder',
  'strafe-left': 'Desplazarse a la izquierda',
  'strafe-right': 'Desplazarse a la derecha',
});

function AuthoredCryptMap({ state }) {
  const enemies = new Map(activeEnemies(state).map(enemy => {
    const position = state.enemyPositions?.[enemy.id]
      || (enemy.positionKey && enemy.positions?.[state[enemy.positionKey]])
      || { x: enemy.x, y: enemy.y };
    return [position.x + ',' + position.y, enemy];
  }));
  return (
    <div className="react-crypt-map" role="img"
      aria-label={`Cripta original. Posición ${state.x + 1},${state.y + 1}; rumbo ${DIRECTIONS[state.direction]?.label}; ${enemies.size} enemigos activos.`}>
      {CRYPT_MAP.grid.flatMap((row, y) => [...row].map((tile, x) => {
        const enemy = enemies.get(x + ',' + y);
        const party = x === state.x && y === state.y;
        const symbol = party ? FACING[state.direction] : enemy ? '✹'
          : tile === 'X' ? '◆' : tile === 'S' ? (state.sigilAwake ? '✦' : '◇')
          : (x === 5 && y === 5) ? '⚙' : tile === '#' ? '' : '·';
        return (
          <span key={x + ',' + y}
            className={['react-crypt-cell', tile === '#' ? 'wall' : '', party ? 'party' : '',
              enemy ? 'enemy' : '', tile === 'S' ? 'sigil' : '', tile === 'X' ? 'gate' : ''].filter(Boolean).join(' ')}
            title={enemy?.name || ''}>{symbol}</span>
        );
      }))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [build, setBuild] = useState(() => createCanonicalChroniclesCharacterBuild(CHRONICLES_PARTY));
  const [state, setState] = useState(createExplorationState);
  const [town, setTown] = useState(createSwordhavenWalkState);
  const [townMenuOpen, setTownMenuOpen] = useState(false);
  const [townMapOpen, setTownMapOpen] = useState(false);
  const [townJournalOpen, setTownJournalOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const validity = validateChroniclesCharacterBuild(build);

  useEffect(() => {
    if (page !== 'explore') return undefined;
    const listener = event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const action = KEY_MOVES[event.key.toLowerCase() === 'arrowup' ? 'ArrowUp'
        : event.key.toLowerCase() === 'arrowdown' ? 'ArrowDown'
        : event.key.toLowerCase() === 'arrowleft' ? 'ArrowLeft'
        : event.key.toLowerCase() === 'arrowright' ? 'ArrowRight'
        : event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      setState(previous => explorationStep(previous, action));
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [page]);

  useEffect(() => {
    if (page !== 'explore') return undefined;
    const onKeyDown = event => {
      if (event.key.toLowerCase() !== 'j' || event.repeat
          || event.ctrlKey || event.altKey || event.metaKey) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      // The original journal traps keydown within its portal. This handler
      // handles J only when focus is outside the journal modal.
      setJournalOpen(open => !open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page]);

  useEffect(() => {
    if (page !== 'town') return undefined;
    const onKeyDown = event => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (townMenuOpen) {
        if (event.key === 'Escape') { event.preventDefault(); setTownMenuOpen(false); }
        return;
      }
      if (townJournalOpen) return; // Journal modal owns Escape, J and focus.
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setTownJournalOpen(true);
        return;
      }
      const action = KEY_MOVES[event.key] || KEY_MOVES[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      setTown(current => swordhavenWalkStep(current, action));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page, townMenuOpen, townJournalOpen]);

  if (page === 'forge') {
    return (
      <div className="chronicles-react">
        <ChroniclesCharacterSetup currentBuild={build} onExit={() => setPage('home')}
          onConfirm={chosen => {
            if (!validateChroniclesCharacterBuild(chosen).valid) return;
            setBuild(chosen);
            setState(createExplorationState());
            setJournalOpen(false);
            setPage('explore');
          }} />
      </div>
    );
  }

  if (page === 'town') {
    const journalEntries = [
      { id: 'swordhaven-arrival', title: 'Llegada a Swordhaven',
        body: 'La compañía ha entrado en la ciudad de Swordhaven.' },
      ...(town.visited?.includes('9,17')
        ? [{ id: 'swordhaven-gate-seen', title: 'Puerta sur',
          body: 'La compañía encontró la salida sur. El viaje al siguiente mapa aún no está disponible.' }]
        : []),
    ];
    return (
      <main className="chronicles-react react-town-screen">
        <h1 className="react-town-sr-only">Swordhaven · Chronicles of Matthias</h1>
        <div className="react-town-playfield">
          <section className="react-town-frame" aria-label="Exploración 3D de Swordhaven">
            <SwordhavenViewport state={town}/>
            <div className="react-town-hud">
              <div className="react-town-objective" aria-label="Objetivo de exploración">
                <small>EXPLORACIÓN · SWORDHAVEN</small>
                <strong>Recorre las calles de Swordhaven</strong>
              </div>

              <div className="react-town-topbar">
                <button type="button" className="react-town-reset"
                  aria-label="Reiniciar recorrido en Swordhaven" title="Reiniciar recorrido"
                  onClick={() => { setTown(createSwordhavenWalkState()); setTownMapOpen(false); }}>↻</button>
                <button type="button" className="react-town-menu-button"
                  aria-label="Abrir menú de Swordhaven" aria-expanded={townMenuOpen}
                  onClick={() => setTownMenuOpen(value => !value)}>MENÚ</button>
              </div>

              <section className="react-town-party" aria-label="Compañía">
                {build.characters.map(character => (
                  <div key={character.slotId} className="react-town-party-member">
                    <img src={chroniclesPartyPortraitUrl(character.slotId)} alt="" aria-hidden="true"/>
                    <span>{character.name}</span>
                  </div>
                ))}
              </section>

              <button type="button" className="react-town-journal"
                onClick={() => setTownJournalOpen(true)}>✥ <span>Crónica</span></button>

              <button type="button" className="react-town-map-toggle"
                aria-label={townMapOpen ? 'Ocultar mapa' : 'Mostrar mapa'}
                aria-expanded={townMapOpen} onClick={() => setTownMapOpen(value => !value)}>▦ <span>Mapa</span></button>
              <div className={'react-town-map-panel' + (townMapOpen ? ' is-open' : '')}>
                <SwordhavenMiniMap state={town}/>
              </div>

              <div className="react-town-status" role="status" aria-live="polite">
                Rumbo {SWORDHAVEN_DIRECTIONS[town.direction]?.name} · X{town.x} Y{town.y} · {town.turns} pasos
              </div>

              <section className="react-town-controls" aria-label="Controles de primera persona">
                {COMMANDS.map(([action, label]) => (
                  <button type="button" key={action} data-town-move={action}
                    aria-label={TOWN_CONTROL_ACCESSIBLE[action]}
                    onClick={() => setTown(previous => swordhavenWalkStep(previous, action))}>
                    <span className="react-town-control-icon" aria-hidden="true">{label.split(' ')[0]}</span>
                    <span className="react-town-control-label">{label.substring(label.indexOf(' ') + 1)}</span>
                  </button>
                ))}
              </section>
              <p className="react-town-message" role="status" aria-live="polite">{town.message}</p>

              {townMenuOpen && (
                <div className="react-town-menu" role="dialog" aria-label="Menú de Swordhaven">
                  <strong>Swordhaven</strong>
                  <button type="button" onClick={() => setTownMenuOpen(false)}>Continuar exploración</button>
                  <button type="button" onClick={() => {
                    setTown(createSwordhavenWalkState()); setTownMapOpen(false); setTownMenuOpen(false);
                  }}>Reiniciar recorrido</button>
                  <button type="button" onClick={() => {
                    setTownMenuOpen(false); setTownJournalOpen(false); setPage('home');
                  }}>Salir al inicio</button>
                  <details className="react-town-help">
                    <summary>Acerca de esta vista</summary>
                    <p>
                      Escenario y colisiones originales de Chess Studio. Teclado: WASD/flechas y Q/E.
                      Esta vista es una migración visual: todavía no hay comerciantes, misiones,
                      combate, cambios de mapa ni guardados. Los retratos no muestran estadísticas de partida.
                    </p>
                  </details>
                </div>
              )}
            </div>
          </section>
        </div>

        <ChroniclesJournalModal open={townJournalOpen}
          state={{ quests: {} }} entries={journalEntries}
          onClose={() => setTownJournalOpen(false)}/>
      </main>
    );
  }

  return (
    <main className="chronicles-react">
      <header className="chronicles-react-header">
        <div><small>CHRONICLES OF MATTHIAS · REACT MIGRATION</small><h1>Crónicas de Matthias</h1></div>
        <span className="react-stage">STAGING · REACT</span>
      </header>
      {page === 'home' ? (
        <section className="react-home">
          <div className="react-intro"><span>LIBRO I · LA COMPAÑÍA</span>
            <h2>La aventura comienza con una decisión.</h2>
            <p>Este es el frontend React autónomo en construcción. El creador de personajes y sus retratos son los originales de Chess Studio, no una simulación.</p>
            <button className="react-primary" type="button" onClick={() => setPage('forge')}>Formar compañía</button>
            <button className="react-primary react-town-entry" type="button"
              onClick={() => { setTown(createSwordhavenWalkState()); setPage('town'); }}>
              Recorrer Swordhaven original en 3D
            </button>
            <p className="react-note">La exploración posterior es todavía parcial. No hay autenticación, combate ni guardados de partida.</p>
          </div>
        </section>
      ) : (
        <section className="react-expedition" aria-label="Exploración">
          <div className="react-topline">
            <div><span>CRIPTA DE LAS OCHO CASILLAS · PREVIEW</span>
              <h2>Primera expedición</h2></div>
            <div className="react-top-actions">
              <button type="button" onClick={() => { setJournalOpen(false); setPage('forge'); }}>Editar compañía</button>
              <button type="button" onClick={() => { setJournalOpen(false); setPage('home'); }}>Salir</button>
            </div>
          </div>
          <p className="react-note">Mapa y lógica básica extraídos de Chronicles. El motor 3D, el combate por iniciativa y la persistencia se integrarán en las siguientes etapas; esta preview no concede experiencia ni modifica guardados.</p>
          <div className="react-expedition-layout">
            <section className="react-board">
              <AuthoredCryptMap state={state}/>
              <p className="react-map-legend">↑ Grupo · ✹ Enemigo · ◇ Sello · ◆ Puerta · ⚙ Palanca</p>
            </section>
            <section className="react-actions">
              <p className="react-coordinates">{`Columna ${state.x + 1} · Fila ${state.y + 1} · Rumbo ${DIRECTIONS[state.direction]?.label} · Turno ${state.turns}`}</p>
              <p className="react-message" role="status" aria-live="polite">{state.message}</p>
              <div className="react-control-grid">
                {COMMANDS.map(([action, label]) => (
                  <button type="button" key={action}
                    onClick={() => setState(previous => explorationStep(previous, action))}>{label}</button>
                ))}
              </div>
              <button className="react-primary" type="button"
                onClick={() => setState(previous => explorationStep(previous, 'interact'))}>
                {visibleInteraction(state)?.label || 'Interactuar'}
              </button>
              <button className="react-muted" type="button"
                onClick={() => setState(createExplorationState())}>Reiniciar exploración</button>
              <p className="react-note">Teclado: WASD o flechas para avanzar, retroceder y girar. Q/E para movimiento lateral.</p>
            </section>
          </div>
          <section className="react-party" aria-label="Compañía">
            {validity.valid && build.characters.map(person => (
              <div key={person.slotId}>
                <strong>{person.name}</strong>
                <span>{CHRONICLES_MM3_CLASSES[person.classId]?.label}</span>
              </div>
            ))}
          </section>
          <button className="react-journal-trigger" type="button" onClick={() => setJournalOpen(true)}>
            Abrir crónica (J) · {state.journal.length} folios
          </button>
          <ChroniclesJournalModal
            open={journalOpen}
            state={state}
            entries={state.journal}
            onClose={() => setJournalOpen(false)}
          />
        </section>
      )}
      <footer className="react-footer">Interfaz React independiente · Sin escrituras de partidas · El juego completo sigue en migración</footer>
    </main>
  );
}
