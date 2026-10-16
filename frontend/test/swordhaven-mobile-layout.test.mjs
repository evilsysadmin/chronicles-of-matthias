import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const walk = readFileSync(new URL('../src/chronicles/swordhavenWalk.js', import.meta.url), 'utf8');

test('mobile Swordhaven is an immersive app shell rather than the old article', () => {
  assert.match(app, /className="react-town-topbar"/);
  assert.match(app, /className="react-town-playfield"/);
  assert.match(app, /className="react-town-controls"/);
  assert.match(app, /className="react-town-party"/);
  assert.match(app, /<SwordhavenViewport state=\{town\}/);
  assert.match(css, /\.react-town-screen\s*\{[^}]*height:100dvh/s);
  assert.match(css, /\.react-town-playfield\s*\{[^}]*min-height:0/s);
  assert.match(css, /\.react-swordhaven-host\s*\{[^}]*position:absolute;inset:0/s);
  assert.match(css, /@media \(max-width:780px\) and \(orientation:portrait\)/);
  assert.match(css, /@media \(max-width:780px\) and \(orientation:landscape\)/);
  assert.doesNotMatch(app, /react-town-bottom|react-town-message"[^>]*>[^<]*<\/p>[\s\S]*react-town-bottom/);
});

test('portrait keeps the four canonical portraits and meaningful touch controls', () => {
  assert.match(app, /build.characters.map\(character =>/);
  assert.match(app, /chroniclesPartyPortraitUrl\(character.slotId\)/);
  assert.match(app, /TOWN_CONTROL_ACCESSIBLE\[action\]/);
  for (const [action, spoken] of [
    ['turn-left', 'Girar a la izquierda'],
    ['turn-right', 'Girar a la derecha'],
    ['forward', 'Avanzar'],
    ['backward', 'Retroceder'],
    ['strafe-left', 'Desplazarse a la izquierda'],
    ['strafe-right', 'Desplazarse a la derecha'],
  ]) {
    assert.ok(app.includes("'"+action+"': '"+spoken+"'") ||
      app.includes(action+": '"+spoken+"'"), action);
  }
  assert.match(css, /touch-action:manipulation/);
  assert.match(css, /\.react-town-party-member img\{width:42px;height:45px/);
});

test('sparse narration and deeper explanation remain honest about unfinished game', () => {
  assert.match(walk, /Swordhaven\. La compañía se adentra en sus calles\./);
  assert.match(app, /<details className="react-town-help">/);
  assert.match(app, /todavía no hay comerciantes, misiones, combate/);
  assert.match(app, /ni guardados/);
  assert.match(app, /aria-label="Reiniciar recorrido en Swordhaven"/);
  assert.match(app, /setTown\(createSwordhavenWalkState\(\)\)/);
  assert.match(css, /\.react-town-message\s*\{[^}]*position:absolute/s);
});

test('diegetic HUD uses the real town state rather than fake MM3 status panels', () => {
  assert.match(app, /<SwordhavenMiniMap state=\{town\}/);
  assert.match(app, /<ChroniclesJournalModal open=\{townJournalOpen\}/);
  assert.match(app, /className="react-town-objective"/);
  assert.match(app, /className="react-town-hud"/);
  assert.match(app, /className="react-town-menu-button"/);
  assert.match(app, /data-town-move=\{action\}/);
  assert.match(app, /visited\?\.includes\('9,17'\)/); // no invented gate discovery
  assert.doesNotMatch(app.slice(app.indexOf("if (page === 'town')"), app.indexOf('  return (\n    <main className="chronicles-react">')),
    /\b(?:maxHp|health|gold|experience|skillPoints)\b/);
  assert.match(css, /\.react-town-frame\s*\{[^}]*height:100%/s);
  assert.match(css, /\.react-town-hud\s*\{[^}]*pointer-events:none/);
  assert.match(css, /\.react-town-controls\s*\{[^}]*position:absolute/);
});
