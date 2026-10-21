import { describe, expect, it } from 'vitest';
import { chroniclesContextualContentAction, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const at = (x, y) => ({ ...createChroniclesState('swordhaven-first-book'), x, y });

describe('Chronicles NPC dialogue · MM3 audience', () => {
  it('opens the mayor at authored internal (11,10), HUD (11,4), with numbered topics and one real quest action', () => {
    const state = at(11, 10);
    const contextual = chroniclesContextualContentAction(state);
    expect(contextual?.id).toBe('swordhaven-mayor');
    const audience = chroniclesNpcDialogueForState(state, contextual);
    expect(audience).toMatchObject({ name: 'Alcalde Aldric', room: 'aldric-hall' });
    expect(audience.choices.map((choice) => choice.kind)).toEqual(['action', 'say', 'say', 'leave']);
    expect(audience.choices[0].label).toBe('Presentar la carta de la Dama');
    expect(audience.choices[0].actionId).toBe('swordhaven-mayor');
    expect(audience.choices[1].answer).toMatch(/caballeros|Dama/);
    expect(chroniclesMapById(state.mapId).grid).toHaveLength(23);
  });

  it('keeps the expanded southern wards connected to every original service and exit', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const grid = town.grid;
    expect(grid).toHaveLength(23);
    expect(grid.every((row) => row.length === 19)).toBe(true);
    const start = town.partyStart;
    const seen = new Set([start.x + ',' + start.y]);
    const queue = [[start.x, start.y]];
    for (let i = 0; i < queue.length; i += 1) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = nx + ',' + ny;
        if (grid[ny]?.[nx] !== '.' || seen.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    expect(seen.has('3,17')).toBe(true);
    expect(seen.has('15,21')).toBe(true);
    for (const entry of [...town.interactables, ...town.exits]) {
      expect(seen.has(entry.x + ',' + entry.y), entry.id).toBe(true);
    }
  });

  it('puts a one-time south-ward warning on reachable floor without hiding the main town services', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const clue = town.interactables.find((entry) => entry.id === 'swordhaven-south-watch-notice');
    expect(clue).toMatchObject({ kind: 'lore', x: 15, y: 21 });
    expect(town.grid[clue.y][clue.x]).toBe('.');
    expect(clue.when).toEqual([{ key: 'swordhavenSouthWatchNoticeRead', falsy: true }]);
    expect(clue.action.effects).toContainEqual({
      type: 'set', key: 'swordhavenSouthWatchNoticeRead', value: true,
    });
    expect(clue.action.journal.id).toBe('swordhaven-south-watch-notice-read');
  });

  it('keeps both southern alley threats optional, separate and off the original service route', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const alleyEnemies = town.enemies.filter((enemy) => enemy.id.startsWith('swordhaven-south-'));
    expect(alleyEnemies).toHaveLength(2);
    expect(alleyEnemies.map((enemy) => [enemy.x, enemy.y])).toEqual([[3, 17], [15, 19]]);
    expect(alleyEnemies.every((enemy) => enemy.optional && town.grid[enemy.y][enemy.x] === '.')).toBe(true);
    expect(new Set(alleyEnemies.map((enemy) => enemy.defeatedFlag)).size).toBe(2);
    expect(new Set(alleyEnemies.map((enemy) => enemy.hpKey)).size).toBe(2);
    const falseWatch = alleyEnemies.find((enemy) => enemy.id === 'swordhaven-south-false-watch');
    expect(falseWatch.onDefeat.effects).toContainEqual({
      type: 'set', key: 'swordhavenSouthFalseWatchDefeated', value: true,
    });
    expect(falseWatch.onDefeat.journal.id).toBe('swordhaven-south-false-watch-falls');
  });

  it('never grants rewards when merely opening a dialogue; talk uses the campaign reducer', () => {
    const before = at(11, 10);
    const audience = chroniclesNpcDialogueForState(before, chroniclesContextualContentAction(before));
    expect(audience).not.toBeNull();
    expect(before.swordhavenMayorMet).toBeFalsy();
    expect(before.inventory?.['sewer-key']).toBeUndefined();
    const after = chroniclesReduce(before, 'interact');
    expect(after.swordhavenMayorMet).toBe(true);
    expect(after.inventory['sewer-key'].quantity).toBe(1);
    const second = chroniclesNpcDialogueForState(after, chroniclesContextualContentAction(after));
    expect(second.choices.filter((choice) => choice.kind === 'action')).toHaveLength(1);
    expect(second.choices.find((choice) => choice.kind === 'action')?.actionId).toBe('swordhaven-mayor-sewers');
  });

  it('keeps NPCs available after one-time dialogue branches have finished', () => {
    const state = at(11, 10);
    const resolved = { ...state, swordhavenMayorMet: true, swordhavenSewersReported: true, swordhavenRouteReported: true };
    const dialogue = chroniclesNpcDialogueForState(resolved, chroniclesContextualContentAction(resolved));
    expect(dialogue.name).toBe('Alcalde Aldric');
    expect(dialogue.choices.map((choice) => choice.kind)).toEqual(['say', 'say', 'leave']);
  });

  it('uses the same numbered model for other authored town NPCs', () => {
    for (const [x, y, name] of [[4, 6, 'Sargento Brask'], [14, 6, 'Sacerdotisa Ilse']]) {
      const state = at(x, y);
      const dialogue = chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));
      expect(dialogue.name).toBe(name);
      expect(dialogue.choices.filter((choice) => choice.kind === 'say')).toHaveLength(2);
      expect(dialogue.choices.at(-1)).toMatchObject({ kind: 'leave' });
    }
  });

  it('never intercepts merchants, guilds or open street tiles', () => {
    const town = chroniclesMapById('swordhaven-first-book');
    const merchant = town.interactables.find((entry) => entry.shop);
    const guild = town.interactables.find((entry) => entry.guild);
    expect(chroniclesNpcDialogueForState(at(merchant.x, merchant.y))).toBeNull();
    expect(chroniclesNpcDialogueForState(at(guild.x, guild.y))).toBeNull();
    expect(chroniclesNpcDialogueForState(at(9, 7))).toBeNull();
  });
});
