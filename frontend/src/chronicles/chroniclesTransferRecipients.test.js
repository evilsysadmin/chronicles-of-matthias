import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTransferGearRecipients, chroniclesTransferGearHint, chroniclesTransferRecipientLabel } from './chroniclesTransferRecipients.js';

const company = () => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
const byId = (rows, id) => rows.find(row => row.memberId === id);
describe('MM3 gear handoff compatibility advice', () => {
  it('uses the actual class restriction, excludes the sender, and never mutates equipment or stock', () => {
    const base = company();
    const state = { ...base, equipment: { matthias: { weapon: 'wooden-mace' } } };
    const original = JSON.stringify(state);
    const rows = chroniclesTransferGearRecipients(state, 'rook', 'brass-sword');
    expect(byId(rows, 'matthias').status).toBe('ready');
    expect(byId(rows, 'bishop').status).toBe('incompatible');
    expect(byId(rows, 'rook')).toBeUndefined();
    expect(chroniclesTransferGearHint(rows)).toContain(state.party.find(hero => hero.id === 'matthias').name);
    expect(chroniclesTransferGearHint(rows)).not.toContain(state.party.find(hero => hero.id === 'bishop').name);
    expect(JSON.stringify(state)).toBe(original);
  });

  it('distinguishes a blocked shield from a usable shield without treating a bow as a hand conflict', () => {
    const base = company();
    const state = { ...base, equipment: { matthias: { weapon: 'wooden-staff', missile: 'wooden-bow' } } };
    expect(byId(chroniclesTransferGearRecipients(state, 'rook', 'iron-shield'), 'matthias').status).toBe('hands');
    const free = { ...state, equipment: { matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' } } };
    expect(byId(chroniclesTransferGearRecipients(free, 'rook', 'iron-shield'), 'matthias').status).toBe('ready');
    expect(chroniclesTransferRecipientLabel('hands')).toBe('Necesita una mano libre');
  });

  it('does not recommend duplicate equipped gear or a fallen recipient', () => {
    const base = company();
    const state = { ...base, equipment: { matthias: { weapon: 'brass-sword' } } };
    expect(byId(chroniclesTransferGearRecipients(state, 'rook', 'brass-sword'), 'matthias').status).toBe('equipped');
    const fallen = { ...state, party: state.party.map(hero => hero.id === 'matthias' ? { ...hero, hp: 0 } : hero) };
    expect(byId(chroniclesTransferGearRecipients(fallen, 'rook', 'brass-sword'), 'matthias').status).toBe('down');
  });

  it('does not attach equipment advice to ordinary loot or Tactics', () => {
    const state = company();
    expect(chroniclesTransferGearRecipients(state, 'rook', 'quest-seal')).toEqual([]);
    expect(chroniclesTransferGearRecipients({ ...state, combatRules: 'tactics' }, 'rook', 'brass-sword')).toEqual([]);
    expect(chroniclesTransferGearHint([])).toBe('');
    expect(chroniclesTransferGearHint([{ status: 'hands' }])).toBe('Ningún otro héroe puede equiparlo ahora.');
  });
});
