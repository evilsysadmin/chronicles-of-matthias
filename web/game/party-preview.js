// First independent Chronicles UI slice: exact MM3 game rules extracted from
// Chess Studio (upstream SHA 41535b8f482f2f0eab3221725a607a5a4bab9b3a).
// This preview never reads or writes credentials, profiles or saved runs.
import {
  CHRONICLES_CHARACTER_NAME_MAX, CHRONICLES_CHARACTER_SLOTS,
  chroniclesRollCharacterStats, createCanonicalChroniclesCharacterBuild,
  createSeededChroniclesCharacterBuild, validateChroniclesCharacterBuild,
} from './chroniclesCharacterBuilds.js';
import {
  CHRONICLES_MM3_ALIGNMENTS, CHRONICLES_MM3_CLASS_IDS,
  CHRONICLES_MM3_CLASSES, CHRONICLES_MM3_RACES, CHRONICLES_MM3_RACE_IDS,
  CHRONICLES_MM3_SEXES, CHRONICLES_MM3_STATS, CHRONICLES_MM3_STAT_LABELS,
  chroniclesMM3ClassAllowed, chroniclesMM3Derived, chroniclesMM3MaxSpellPoints,
} from './chroniclesMM3Rules.js';

export const PREVIEW_PARTY = Object.freeze([
  Object.freeze({ id: 'matthias', name: 'Matthias' }),
  Object.freeze({ id: 'rook', name: 'Hildegard' }),
  Object.freeze({ id: 'bishop', name: 'Aziz' }),
  Object.freeze({ id: 'knight', name: 'Faust' }),
]);

export function newPreviewParty(seed) {
  return createSeededChroniclesCharacterBuild(String(seed).slice(0, 48), PREVIEW_PARTY);
}

export function updatePreviewCharacter(build, slotId, field, value) {
  if (!CHRONICLES_CHARACTER_SLOTS.includes(slotId)) throw new RangeError('Casilla inexistente');
  const original = build.characters.find(character => character.slotId === slotId);
  if (!original) throw new RangeError('Personaje inexistente');
  if (!['name', 'classId', 'raceId', 'sex', 'alignment'].includes(field)) {
    throw new RangeError('Campo no editable');
  }
  if (field === 'classId' && !chroniclesMM3ClassAllowed(value, original.stats)) {
    throw new RangeError('La tirada no permite esa clase');
  }
  if (field === 'raceId' && !CHRONICLES_MM3_RACE_IDS.includes(value)) {
    throw new RangeError('Raza inexistente');
  }
  if (field === 'sex' && !Object.hasOwn(CHRONICLES_MM3_SEXES, value)) {
    throw new RangeError('Sexo inexistente');
  }
  if (field === 'alignment' && !Object.hasOwn(CHRONICLES_MM3_ALIGNMENTS, value)) {
    throw new RangeError('Alineamiento inexistente');
  }
  const next = build.characters.map(character => character.slotId === slotId ? {
    ...character, stats: { ...character.stats },
    [field]: field === 'name' ? String(value).trim().slice(0, CHRONICLES_CHARACTER_NAME_MAX) : value,
  } : { ...character, stats: { ...character.stats } });
  return { version: 2, mode: 'custom', characters: next };
}

export function rerollPreviewCharacter(build, slotId, random = Math.random) {
  if (!CHRONICLES_CHARACTER_SLOTS.includes(slotId)) throw new RangeError('Casilla inexistente');
  return {
    ...build, mode: 'custom',
    characters: build.characters.map(character => character.slotId === slotId
      ? { ...character, ...chroniclesRollCharacterStats(random, character.classId) }
      : { ...character, stats: { ...character.stats } }),
  };
}

function optionSelect(labelText, choices, selected, onChange) {
  const label = document.createElement('label');
  label.textContent = labelText;
  const select = document.createElement('select');
  for (const [value, title] of choices) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = title;
    option.selected = value === selected;
    select.append(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  label.append(select);
  return label;
}

function createSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const words = new Uint32Array(2);
    crypto.getRandomValues(words);
    return Array.from(words, part => part.toString(16).padStart(8, '0')).join('-');
  }
  return String(Date.now()) + '-' + String(Math.random());
}

export function mountPartyForge() {
  const tabs = document.getElementById('party-tabs');
  const sheet = document.getElementById('character-sheet');
  const message = document.getElementById('forge-message');
  const rollParty = document.getElementById('roll-party');
  const resetParty = document.getElementById('reset-party');
  if (!tabs || !sheet || !message || !rollParty || !resetParty) return;
  let build = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY);
  let active = CHRONICLES_CHARACTER_SLOTS[0];

  const redraw = () => {
    tabs.replaceChildren();
    sheet.replaceChildren();
    const validity = validateChroniclesCharacterBuild(build);
    message.classList.toggle('error', !validity.valid);
    message.textContent = validity.valid
      ? 'Compañía válida. Las clases cumplen sus requisitos de atributos.'
      : 'Revisa la compañía: ' + validity.errors.join(' · ');

    for (const character of build.characters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(character.slotId === active));
      const name = document.createElement('b');
      name.textContent = character.name || 'Sin nombre';
      const job = document.createElement('span');
      job.textContent = CHRONICLES_MM3_CLASSES[character.classId]?.label || 'Sin clase';
      button.append(name, job);
      button.addEventListener('click', () => { active = character.slotId; redraw(); });
      button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const index = CHRONICLES_CHARACTER_SLOTS.indexOf(active);
        active = CHRONICLES_CHARACTER_SLOTS[(index + offset + 4) % 4];
        redraw();
        tabs.children[CHRONICLES_CHARACTER_SLOTS.indexOf(active)].focus();
      });
      tabs.append(button);
    }

    const character = build.characters.find(item => item.slotId === active);
    const derived = chroniclesMM3Derived(character.classId, character.stats, { raceId: character.raceId });
    const heading = document.createElement('div');
    heading.className = 'sheet-top';
    const title = document.createElement('h3');
    title.textContent = 'Ficha de ' + (character.name || 'aventurero');
    const reroll = document.createElement('button');
    reroll.type = 'button'; reroll.className = 'action action-muted';
    reroll.textContent = '🎲 Repetir tirada';
    reroll.addEventListener('click', () => { build = rerollPreviewCharacter(build, active); redraw(); });
    heading.append(title, reroll);
    sheet.append(heading);

    const layout = document.createElement('div');
    layout.className = 'sheet-grid';
    const fields = document.createElement('div');
    const fieldGrid = document.createElement('div');
    fieldGrid.className = 'field-grid';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = CHRONICLES_CHARACTER_NAME_MAX;
    nameInput.value = character.name;
    nameInput.autocomplete = 'off';
    nameInput.addEventListener('change', () => {
      build = updatePreviewCharacter(build, active, 'name', nameInput.value);
      redraw();
    });
    nameLabel.append(nameInput);
    fieldGrid.append(nameLabel);

    const choices = CHRONICLES_MM3_CLASS_IDS
      .filter(id => chroniclesMM3ClassAllowed(id, character.stats))
      .map(id => [id, CHRONICLES_MM3_CLASSES[id].label]);
    fieldGrid.append(optionSelect('Clase', choices, character.classId,
      id => { build = updatePreviewCharacter(build, active, 'classId', id); redraw(); }));
    fieldGrid.append(optionSelect('Raza', CHRONICLES_MM3_RACE_IDS
      .map(id => [id, CHRONICLES_MM3_RACES[id].label]), character.raceId,
    id => { build = updatePreviewCharacter(build, active, 'raceId', id); redraw(); }));
    fieldGrid.append(optionSelect('Identidad', Object.entries(CHRONICLES_MM3_SEXES),
      character.sex, id => { build = updatePreviewCharacter(build, active, 'sex', id); redraw(); }));
    fieldGrid.append(optionSelect('Alineamiento', Object.entries(CHRONICLES_MM3_ALIGNMENTS),
      character.alignment, id => { build = updatePreviewCharacter(build, active, 'alignment', id); redraw(); }));
    fields.append(fieldGrid);
    const details = document.createElement('p');
    details.className = 'character-details';
    details.textContent = CHRONICLES_MM3_CLASSES[character.classId].summary;
    fields.append(details);

    const attributes = document.createElement('div');
    const stats = document.createElement('dl');
    stats.className = 'stats';
    for (const key of CHRONICLES_MM3_STATS) {
      const row = document.createElement('div'); row.className = 'stat';
      const dt = document.createElement('dt'); dt.textContent = CHRONICLES_MM3_STAT_LABELS[key];
      const dd = document.createElement('dd'); dd.textContent = String(character.stats[key]);
      const bonus = derived.bonuses[key];
      const small = document.createElement('small');
      small.textContent = '(' + (bonus >= 0 ? '+' : '') + bonus + ')';
      dd.append(small);
      row.append(dt, dd); stats.append(row);
    }
    attributes.append(stats);
    const derivedRow = document.createElement('div'); derivedRow.className = 'derived';
    const sp = chroniclesMM3MaxSpellPoints(character.classId, character.stats, character.raceId);
    for (const text of [
      '♥ Vida: ' + derived.maxHp,
      '✦ Magia: ' + sp,
      '⚔ Ataque: ' + (derived.toHit >= 0 ? '+' : '') + derived.toHit,
      '⛨ Armadura: ' + derived.armorClass,
      '⏱ Iniciativa: ' + (derived.initiativeBonus >= 0 ? '+' : '') + derived.initiativeBonus,
    ]) {
      const badge = document.createElement('span');
      badge.textContent = text; derivedRow.append(badge);
    }
    attributes.append(derivedRow);
    layout.append(fields, attributes);
    sheet.append(layout);
  };
  rollParty.addEventListener('click', () => { build = newPreviewParty(createSeed()); redraw(); });
  resetParty.addEventListener('click', () => { build = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY); redraw(); });
  redraw();
}

if (typeof document !== 'undefined') mountPartyForge();
