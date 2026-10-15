import { CHRONICLES_MM3_STATS, CHRONICLES_MM3_RACE_IDS, CHRONICLES_MM3_CLASS_IDS } from './chronicles/chroniclesMM3Rules.js';
import { CHRONICLES_INITIATIVE_DIE_SIDES } from './chronicles/initiativeCore.js';
import { chroniclesCheckpointReason } from './chronicles/chroniclesSavePolicy.js';

const app = document.querySelector('#app');
app.innerHTML = `<main><h1>Chronicles of Matthias</h1><p>Independent runtime integration in progress.</p><dl><dt>Character attributes</dt><dd>${CHRONICLES_MM3_STATS.length}</dd><dt>Races</dt><dd>${CHRONICLES_MM3_RACE_IDS.length}</dd><dt>Classes</dt><dd>${CHRONICLES_MM3_CLASS_IDS.length}</dd><dt>Initiative die</dt><dd>d${CHRONICLES_INITIATIVE_DIE_SIDES}</dd><dt>Save policy</dt><dd>${chroniclesCheckpointReason('town','dungeon')}</dd></dl><p>The original playable game remains in Chess Studio during migration.</p></main>`;
