// A headless player for balance work: it walks the real maps, fights with
// the real reducer, initiative and enemy AI, earns XP through the real
// progression and follows a scripted route through the main story. It never
// touches the UI or the network. It reports what a careful human would feel:
// party level, gold, rests, deaths and how long each fight takes.
import {
  CHRONICLES_DIRECTIONS,
  chroniclesActiveEnemies,
  chroniclesEnemyPosition,
  chroniclesEnemyTargetAhead,
  chroniclesPartyArmorClass,
  chroniclesPartyAttackStats,
  chroniclesReduce,
  createChroniclesState,
} from '../../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor, chroniclesRuntimeEnemyPosition } from '../../chroniclesOfMatthiasTurns.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from '../chroniclesInitiative.js';
import { chroniclesGridExplorationStep } from '../chroniclesGridExplorationStep.js';
import {
  applyChroniclesProgressionToTacticsState,
  applyChroniclesTacticsProgression,
  chroniclesAllowedAttributes,
  chroniclesHeroProgress,
  createChroniclesProgression,
  reconcileChroniclesProgressionInTacticsState,
  chroniclesSkillsForMember,
  spendChroniclesAttributePoint,
  unlockChroniclesSkill,
} from '../../chroniclesOfMatthiasProgression.js';
import { chroniclesApplyStartingKit } from '../chroniclesStartingKit.js';
import { chroniclesMapById, chroniclesMapContentPosition, chroniclesMapIds } from '../chroniclesMapCatalog.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../chroniclesContentRuntime.js';
import {
  CHRONICLES_EQUIPMENT,
  chroniclesEquipItem,
  chroniclesEquippedItem,
  chroniclesMemberCanEquip,
} from '../chroniclesEquipment.js';
import { CHRONICLES_SPELLS, chroniclesMemberKnowsSpell, chroniclesMemberSp } from '../chroniclesMagic.js';
import { CHRONICLES_CONSUMABLES, chroniclesConsumableCount } from '../chroniclesConsumables.js';
import { chroniclesGuildCanLearn, chroniclesGuildMember } from '../chroniclesGuild.js';

const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ATTRIBUTE_PLAN = {
  matthias: ['vigor', 'power', 'vigor', 'power', 'agility'],
  rook: ['vigor', 'power', 'vigor', 'power', 'will'],
  bishop: ['vigor', 'precision', 'will', 'vigor', 'precision'],
  knight: ['vigor', 'precision', 'vigor', 'precision', 'agility'],
};

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class BotError extends Error {}

function serviceCost(entry) {
  return (entry.requirements || []).filter((requirement) => requirement.itemId === 'crown-gold')
    .reduce((sum, requirement) => sum + (requirement.quantity || 0), 0);
}

// Reach counts for the back row: a bow lets it strike over the front line.
// The front line wants the shield hand free instead.
function itemScore(item, member = null) {
  if (!item) return -1;
  const reach = Math.max(0, (item.reach || 1) - 1);
  return item.attackDamageBonus * 3 + item.armorClassBonus * 2 + item.damageReduction * 3 + (item.toHitBonus || 0)
    + (member?.row === 'back' ? reach * 2 : item.twoHanded && item.reach > 1 ? -4 : 0);
}

// What a careful player copies into each caster's book, best first. The
// guild must sell it and the school must teach it.
const SPELL_PRIORITY = Object.freeze([
  'heal-wounds', 'fireball', 'mass-heal', 'lightning-bolt', 'holy-strike', 'faith-ward',
  'paralyze', 'cold-ray', 'poison-cloud', 'elemental-arrow', 'flying-fist', 'first-aid',
]);
const ATTACK_SPELLS = Object.freeze(['lightning-bolt', 'holy-strike', 'poison-cloud', 'cold-ray', 'elemental-arrow', 'flying-fist']);

// Potions a careful player keeps in the pack, bought at every botica.
const POTION_KIT = Object.freeze({ 'healing-potion': 3, 'revive-draught': 1 });

// Everything an interaction can change, minus the narration.
function fingerprint(state) {
  const { message, turns, journal, ...rest } = state;
  return JSON.stringify(rest);
}

export class ChroniclesCampaignBot {
  constructor({ runId = 'sim-run', startMap = 'swordhaven-first-book' } = {}) {
    this.runId = runId;
    this.progression = createChroniclesProgression();
    const base = createChroniclesState(startMap, this.progression.characterBuild, { rules: 'mm3' });
    const withKit = chroniclesApplyStartingKit(base, { worldVersion: 0, status: 'active', worldFlags: {} });
    this.state = { ...applyChroniclesProgressionToTacticsState(withKit, this.progression), runSeed: runId };
    this.fights = [];
    this.rests = 0;
    this.restGold = 0;
    this.deaths = [];
    this.revives = 0;
    this.actions = 0;
    this.milestones = [];
    this.purchases = [];
    this.skills = [];
    this.swings = {};
    this.attributePlan = Object.fromEntries(Object.entries(ATTRIBUTE_PLAN).map(([id, plan]) => [id, [...plan]]));
    this.shoppedAt = new Set();
    this.casts = {};
    this.learned = [];
    this.arrivedOnce = false;
    this.currentLabel = 'inicio';
  }

  // ─── one action, exactly as the game's dispatch handles it ─────────────
  act(action) {
    const current = this.state;
    if (current.phase === 'defeated') throw new BotError('party defeated');
    this.actions += 1;
    if (this.actions > 400000) throw new BotError('action budget exhausted');
    const actionType = typeof action === 'string' ? action : action.type;
    let next;
    const active = chroniclesCurrentInitiativeActor(current.initiative);
    if (!current.initiative) {
      const spell = actionType === 'cast' ? CHRONICLES_SPELLS[action.spellId]
        : actionType === 'use-item' && CHRONICLES_CONSUMABLES[action.itemId]?.kind === 'scroll'
          ? { ...CHRONICLES_CONSUMABLES[action.itemId].spell, kind: 'attack' } : null;
      const offensive = actionType === 'attack' || ['attack', 'paralyze'].includes(spell?.kind);
      const exploratory = offensive ? current : chroniclesGridExplorationStep(current, action);
      const attacker = offensive ? current.party.find((member) => member.id === action.memberId) : null;
      const forced = attacker
        ? chroniclesEnemyTargetAhead(current, spell?.reach ?? chroniclesPartyAttackStats(current, attacker.id).reach)
        : null;
      const transitioned = exploratory?.mapId !== current.mapId;
      const started = transitioned ? exploratory : chroniclesStartInitiativeCombat(
        exploratory, chroniclesActiveEnemies(exploratory), { forceEnemyIds: forced ? [forced.enemy.id] : [] },
      );
      next = started !== exploratory ? started : offensive ? chroniclesReduce(current, action) : exploratory;
    } else {
      next = chroniclesReduce(current, action);
      const spentTurn = (actionType !== 'cast' && actionType !== 'use-item') || next.turns !== current.turns;
      if (next !== current && spentTurn && next.phase !== 'defeated' && next.phase !== 'escaped') {
        next = chroniclesAdvanceCombatInitiative(next, chroniclesActiveEnemies(next));
      }
    }
    const actorMemberId = (typeof action === 'object' && action.memberId)
      || (active?.kind === 'party' ? active.id : 'matthias');
    this.applyProgress(current, next, actorMemberId, actionType);
    this.resolveEnemyTurns();
    this.noteDeaths(current);
    return this.state;
  }

  applyProgress(previous, next, actorMemberId, actionKind) {
    const result = applyChroniclesTacticsProgression(this.progression, previous, next, {
      actorMemberId, actionKind, runId: this.runId,
    });
    this.progression = result.progression;
    let state = next;
    if (result.awards.length || result.levelUps.length) {
      this.spendPoints();
      state = reconcileChroniclesProgressionInTacticsState(state, this.progression);
    }
    this.state = state;
  }

  spendPoints() {
    // Doctrines: the first one each level allows, preferring sturdier picks.
    const prefer = (skill) => Number(skill.modifiers?.bonusMaxHp || 0) * 2 + Number(skill.modifiers?.attackDamageBonus || 0) * 2
      + Number(skill.modifiers?.abilityCharges || 0) + Number(skill.modifiers?.abilityPotencyBonus || 0) * 0.5;
    for (const memberId of Object.keys(ATTRIBUTE_PLAN)) {
      const skills = [...chroniclesSkillsForMember(memberId)].sort((left, right) => prefer(right) - prefer(left));
      for (const skill of skills) {
        if (chroniclesHeroProgress(this.progression, memberId).skillPoints <= 0) break;
        const result = unlockChroniclesSkill(this.progression, memberId, skill.id);
        if (result.unlocked) {
          this.progression = result.progression;
          this.skills.push({ memberId, skillId: skill.id, step: this.currentLabel });
        }
      }
    }
    for (const memberId of Object.keys(ATTRIBUTE_PLAN)) {
      let guard = 0;
      while (chroniclesHeroProgress(this.progression, memberId).attributePoints > 0 && guard < 40) {
        guard += 1;
        const hero = chroniclesHeroProgress(this.progression, memberId);
        const plan = this.attributePlan[memberId];
        const key = plan.find((attribute) => hero.attributes[attribute] < 5 && chroniclesAllowedAttributes(memberId).includes(attribute))
          || chroniclesAllowedAttributes(memberId).find((attribute) => hero.attributes[attribute] < 5);
        if (!key) break;
        const spent = spendChroniclesAttributePoint(this.progression, memberId, key);
        if (!spent.spent) break;
        this.progression = spent.progression;
        // Cycle the plan so points spread instead of piling on one attribute.
        this.attributePlan[memberId] = [...plan.slice(1), plan[0]];
      }
    }
  }

  resolveEnemyTurns() {
    let guard = 0;
    while (this.state.initiative && this.state.phase !== 'defeated') {
      const actor = chroniclesCurrentInitiativeActor(this.state.initiative);
      if (actor?.kind !== 'enemy') break;
      guard += 1;
      if (guard > 200) throw new BotError('enemy turn loop');
      const before = this.state;
      const acted = chroniclesResolveEnemyActor(before, actor.id);
      for (const event of acted.enemyTurnEvents || []) {
        if (event.type !== 'attack') continue;
        const tally = this.swings[this.currentLabel] || (this.swings[this.currentLabel] = { swings: 0, hits: 0, damage: 0 });
        tally.swings += 1;
        if (!event.missed) { tally.hits += 1; tally.damage += event.damage; }
      }
      this.state = acted.phase === 'defeated' ? acted : chroniclesAdvanceCombatInitiative(acted, chroniclesActiveEnemies(acted));
      this.noteDeaths(before);
    }
  }

  noteDeaths(before) {
    const was = new Map(before.party.map((member) => [member.id, member.hp]));
    this.state.party.forEach((member) => {
      const last = this.deaths.at(-1);
      const counted = last?.memberId === member.id && last.actions === this.actions;
      if (member.hp <= 0 && (was.get(member.id) ?? 0) > 0 && !counted) {
        this.deaths.push({ memberId: member.id, mapId: this.state.mapId, step: this.currentLabel, actions: this.actions });
      }
    });
    if (this.state.phase === 'defeated') throw new BotError(`party defeated in ${this.state.mapId} during «${this.currentLabel}»`);
  }

  // ─── combat ─────────────────────────────────────────────────────────────
  aliveEnemies() {
    return chroniclesActiveEnemies(this.state).filter((enemy) => Number(this.state[enemy.hpKey] || 0) > 0);
  }

  fight() {
    if (!this.state.initiative) return;
    let partyTurns = 0;
    const hpBefore = this.partyHp();
    const enemies = this.aliveEnemies().map((enemy) => enemy.id);
    let guard = 0;
    let lowest = 1;
    const maxHp = this.state.party.reduce((sum, member) => sum + member.maxHp, 0);
    let heroLowest = 1;
    const track = () => {
      lowest = Math.min(lowest, this.partyHp() / maxHp);
      this.state.party.forEach((member) => { heroLowest = Math.min(heroLowest, Math.max(0, member.hp) / member.maxHp); });
    };
    while (this.state.initiative && this.state.phase !== 'defeated') {
      guard += 1;
      if (guard > 600) throw new BotError(`fight stalled in ${this.state.mapId}`);
      const actor = chroniclesCurrentInitiativeActor(this.state.initiative);
      if (!actor || actor.kind !== 'party') { this.resolveEnemyTurns(); track(); continue; }
      partyTurns += 1;
      this.act(this.chooseCombatAction(actor.id));
      track();
    }
    this.fights.push({
      mapId: this.state.mapId, step: this.currentLabel, enemies,
      partyTurns,
      hpLost: Math.max(0, hpBefore - this.partyHp()),
      lowest,
      heroLowest,
    });
    if (this.hurt(0.35)) this.needsRest = true;
  }

  chooseCombatAction(memberId) {
    const member = this.state.party.find((candidate) => candidate.id === memberId);
    const sp = chroniclesMemberSp(this.state, member);
    const wounded = this.state.party
      .filter((ally) => ally.hp > 0 && ally.hp <= ally.maxHp * 0.45)
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
    const knows = (id) => chroniclesMemberKnowsSpell(this.state, member, id) && sp >= CHRONICLES_SPELLS[id].cost;
    const cast = (spellId) => {
      this.casts[spellId] = (this.casts[spellId] || 0) + 1;
      return { type: 'cast', memberId, spellId };
    };
    // Several allies hurt at once: one group heal beats two single ones.
    const hurt = this.state.party.filter((ally) => ally.hp > 0 && ally.hp <= ally.maxHp * 0.55);
    if (hurt.length >= 2 && knows('mass-heal')) return cast('mass-heal');
    const heal = ['heal-wounds', 'first-aid'].find(knows);
    if (wounded && heal) return cast(heal);
    // A healer keeps enough for one more cure before spending on anything else.
    const healReserve = ['heal-wounds', 'first-aid']
      .filter((id) => chroniclesMemberKnowsSpell(this.state, member, id))
      .map((id) => CHRONICLES_SPELLS[id].cost)[0] || 0;
    const affordable = (id) => knows(id) && sp - CHRONICLES_SPELLS[id].cost >= healReserve;
    const foes = chroniclesActiveEnemies(this.state);
    // Open a hard fight with the ward: several foes, or a boss-grade one.
    if (this.state.initiative && !this.state.combatWard && affordable('faith-ward')
      && (foes.length >= 3 || foes.some((enemy) => enemy.maxHp >= 30))) return cast('faith-ward');
    const ahead = chroniclesEnemyTargetAhead(this.state, 3);
    // Hold the toughest thing in front of us still while the rest hit it.
    if (ahead && ahead.enemy.maxHp >= 30 && !this.state.enemyStatus?.[ahead.enemy.id]?.paralyzed
      && affordable('paralyze')) return cast('paralyze');
    // A fireball pays when it also burns a neighbour of the target.
    if (ahead && affordable('fireball')) {
      const center = chroniclesEnemyPosition(this.state, ahead.enemy);
      const neighbours = foes.filter((enemy) => enemy.id !== ahead.enemy.id && (() => {
        const position = chroniclesEnemyPosition(this.state, enemy);
        return Math.max(Math.abs(position.x - center.x), Math.abs(position.y - center.y)) <= 1;
      })());
      if (neighbours.length) return cast('fireball');
    }
    // No healing magic at hand: drink from the pack.
    const fallen = this.state.party.some((ally) => ally.hp <= 0);
    if (fallen && chroniclesConsumableCount(this.state, 'revive-draught') > 0) {
      this.potionsUsed = (this.potionsUsed || 0) + 1;
      return { type: 'use-item', memberId, itemId: 'revive-draught' };
    }
    if (wounded && wounded.hp <= wounded.maxHp * 0.35 && chroniclesConsumableCount(this.state, 'healing-potion') > 0) {
      this.potionsUsed = (this.potionsUsed || 0) + 1;
      return { type: 'use-item', memberId, itemId: 'healing-potion' };
    }
    const reach = chroniclesPartyAttackStats(this.state, memberId).reach;
    const attackSpell = ATTACK_SPELLS
      .find((id) => affordable(id) && chroniclesEnemyTargetAhead(this.state, CHRONICLES_SPELLS[id].reach));
    if (attackSpell && !chroniclesEnemyTargetAhead(this.state, reach)) return cast(attackSpell);
    if (chroniclesEnemyTargetAhead(this.state, reach)) return { type: 'attack', memberId };
    if (attackSpell) return cast(attackSpell);
    // Nobody in reach ahead: close in on the nearest foe by a real path,
    // then face it. A foe walled off from us is left behind.
    const target = this.nearestEnemy({ reachable: true });
    if (!target) return this.stepAway();
    if (target.distance === 1 || (target.distance <= reach && this.lineClear(target))) {
      const dir = this.directionTo(target);
      if (dir !== this.state.direction) return this.turnToward(dir);
      return { type: 'attack', memberId };
    }
    const [nx, ny] = target.path[0];
    const dir = STEP.findIndex(([dx, dy]) => this.state.x + dx === nx && this.state.y + dy === ny);
    if (dir !== this.state.direction) return this.turnToward(dir);
    return 'forward';
  }

  lineClear(target) {
    const dx = Math.sign(target.x - this.state.x);
    const dy = Math.sign(target.y - this.state.y);
    if (dx !== 0 && dy !== 0) return false;
    const map = chroniclesMapById(this.state.mapId);
    for (let x = this.state.x + dx, y = this.state.y + dy; x !== target.x || y !== target.y; x += dx, y += dy) {
      if (map.grid[y]?.[x] === '#') return false;
    }
    return true;
  }

  stepAway() {
    const foe = this.nearestEnemy();
    for (let d = 0; d < 4; d += 1) {
      const [dx, dy] = STEP[d];
      const x = this.state.x + dx;
      const y = this.state.y + dy;
      if (!this.walkable(x, y, this.state.mapId) || this.exitCells(chroniclesMapById(this.state.mapId)).has(`${x},${y}`)) continue;
      if (foe && Math.abs(foe.x - x) + Math.abs(foe.y - y) < foe.distance) continue;
      if (d !== this.state.direction) return this.turnToward(d);
      return 'forward';
    }
    return 'turn-left';
  }

  nearestEnemy({ reachable = false } = {}) {
    let best = null;
    for (const enemy of this.aliveEnemies()) {
      const position = chroniclesRuntimeEnemyPosition(this.state, enemy);
      let distance = Math.abs(position.x - this.state.x) + Math.abs(position.y - this.state.y);
      let path = null;
      if (reachable) {
        path = this.path(position);
        if (!path) continue;
        distance = path.length;
      }
      if (!best || distance < best.distance) best = { ...position, distance, enemy, path };
    }
    return best;
  }

  directionTo(target) {
    const dx = target.x - this.state.x;
    const dy = target.y - this.state.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
    return dy >= 0 ? 2 : 0;
  }

  turnToward(direction) {
    const right = (direction - this.state.direction + 4) % 4;
    return right === 3 ? 'turn-left' : 'turn-right';
  }

  partyHp() {
    return this.state.party.reduce((sum, member) => sum + Math.max(0, member.hp), 0);
  }

  // ─── movement ───────────────────────────────────────────────────────────
  walkable(x, y, mapId) {
    const map = chroniclesMapById(mapId);
    const row = map.grid[y];
    if (!row || row[x] === undefined || row[x] === '#') return false;
    return !this.aliveEnemies().some((enemy) => {
      const position = chroniclesRuntimeEnemyPosition(this.state, enemy);
      return position.x === x && position.y === y;
    });
  }

  // Cells that move the party the moment it steps on them.
  exitCells(map) {
    return new Set((map.exits || []).map((exit) => {
      const position = chroniclesMapContentPosition(map, exit);
      return position ? `${position.x},${position.y}` : null;
    }).filter(Boolean));
  }

  path(goal, { throughEnemies = false } = {}) {
    const map = chroniclesMapById(this.state.mapId);
    const exits = this.exitCells(map);
    const start = `${this.state.x},${this.state.y}`;
    const goalKey = `${goal.x},${goal.y}`;
    const previous = new Map([[start, null]]);
    const queue = [[this.state.x, this.state.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (`${x},${y}` === goalKey) break;
      for (let d = 0; d < 4; d += 1) {
        const nx = x + STEP[d][0];
        const ny = y + STEP[d][1];
        const key = `${nx},${ny}`;
        if (previous.has(key)) continue;
        const isGoal = key === goalKey;
        if (!isGoal && exits.has(key)) continue;
        if (!isGoal && (throughEnemies ? !this.floor(nx, ny) : !this.walkable(nx, ny, this.state.mapId))) continue;
        if (isGoal && map.grid[ny]?.[nx] === '#') continue;
        previous.set(key, `${x},${y}`);
        queue.push([nx, ny]);
      }
    }
    if (!previous.has(goalKey)) return null;
    const steps = [];
    for (let key = goalKey; key !== start; key = previous.get(key)) steps.unshift(key.split(',').map(Number));
    return steps;
  }

  floor(x, y) {
    const cell = chroniclesMapById(this.state.mapId).grid[y]?.[x];
    return cell !== undefined && cell !== '#';
  }

  enemyAt(x, y) {
    return this.aliveEnemies().find((enemy) => {
      const position = chroniclesRuntimeEnemyPosition(this.state, enemy);
      return position.x === x && position.y === y;
    });
  }

  // Walk to a cell, fighting whatever engages on the way.
  walkTo(goal, { adjacent = false } = {}) {
    let guard = 0;
    while (!(this.state.x === goal.x && this.state.y === goal.y)) {
      guard += 1;
      if (guard > 2000) throw new BotError(`cannot reach ${goal.x},${goal.y} in ${this.state.mapId}`);
      if (this.state.initiative) { this.fight(); continue; }
      if (this.retreatIfBattered()) continue;
      const mapBefore = this.state.mapId;
      const steps = this.path(goal);
      if (!steps) {
        // Something is in the way (a sentry on the corridor): go fight it.
        const through = this.path(goal, { throughEnemies: true });
        const blocker = through?.map(([x, y]) => this.enemyAt(x, y)).find(Boolean);
        if (!blocker) throw new BotError(`no path to ${goal.x},${goal.y} in ${this.state.mapId}`);
        this.engage(blocker);
        continue;
      }
      if (adjacent && steps.length === 1) return;
      const [nx, ny] = steps[0];
      const dir = STEP.findIndex(([dx, dy]) => this.state.x + dx === nx && this.state.y + dy === ny);
      if (dir !== this.state.direction) { this.act(this.turnToward(dir)); continue; }
      this.act('forward');
      if (this.state.mapId !== mapBefore) return;
    }
  }

  engage(enemy) {
    let guard = 0;
    let plan = null;
    while (Number(this.state[enemy.hpKey] || 0) > 0) {
      guard += 1;
      if (guard > 400) throw new BotError(`cannot engage ${enemy.id}`);
      if (this.state.initiative) { this.fight(); continue; }
      if (this.retreatIfBattered()) continue;
      const position = chroniclesRuntimeEnemyPosition(this.state, enemy);
      const distance = Math.abs(position.x - this.state.x) + Math.abs(position.y - this.state.y);
      if (distance === 1) {
        const dir = this.directionTo(position);
        if (dir !== this.state.direction) { this.act(this.turnToward(dir)); continue; }
        this.act({ type: 'attack', memberId: this.frontAttacker() });
        continue;
      }
      // Others in the corridor are fought on the way. A roaming enemy far
      // away flips between equally short routes as it moves; keep walking the
      // route already chosen until it is close, so the company does not dither.
      const fresh = () => this.path(position) || this.path(position, { throughEnemies: true });
      const keepPlan = distance > 3 && plan?.length > 0
        && Math.abs(plan[0][0] - this.state.x) + Math.abs(plan[0][1] - this.state.y) === 1;
      const steps = keepPlan ? plan : fresh();
      if (!steps) throw new BotError(`no way to ${enemy.id} in ${this.state.mapId}`);
      const [nx, ny] = steps[0];
      const dir = STEP.findIndex(([dx, dy]) => this.state.x + dx === nx && this.state.y + dy === ny);
      if (dir !== this.state.direction) { this.act(this.turnToward(dir)); continue; }
      if (this.enemyAt(nx, ny)) {
        plan = null;
        this.act({ type: 'attack', memberId: this.frontAttacker() });
      } else {
        const before = [this.state.x, this.state.y];
        this.act('forward');
        const moved = this.state.x !== before[0] || this.state.y !== before[1];
        plan = moved ? steps.slice(1) : null;
      }
    }
  }

  frontAttacker() {
    return ['rook', 'matthias', 'knight', 'bishop'].find((id) => this.state.party.find((member) => member.id === id)?.hp > 0) || 'matthias';
  }

  // Shortest route over the world graph by exits, then walk it.
  travelTo(targetMapId) {
    if (!this.arrivedOnce) {
      this.arrivedOnce = true;
      this.afterArrival();
    }
    let guard = 0;
    while (this.state.mapId !== targetMapId) {
      guard += 1;
      if (guard > 60) throw new BotError(`cannot travel to ${targetMapId}`);
      const exit = this.nextExitToward(targetMapId);
      if (!exit) throw new BotError(`no route from ${this.state.mapId} to ${targetMapId}`);
      const position = chroniclesMapContentPosition(chroniclesMapById(this.state.mapId), exit);
      const before = this.state.mapId;
      this.walkTo(position);
      if (this.state.mapId === before) this.stepOffAndBack(position);
      if (this.state.mapId === before) {
        throw new BotError(`exit ${exit.id} in ${before} did not move the party`);
      }
      this.afterArrival();
    }
  }

  // Standing on the gate we arrived by: it only fires when walked onto again.
  stepOffAndBack(position) {
    const map = chroniclesMapById(this.state.mapId);
    const exits = this.exitCells(map);
    const d = [0, 1, 2, 3].find((candidate) => {
      const x = position.x + STEP[candidate][0];
      const y = position.y + STEP[candidate][1];
      return this.walkable(x, y, this.state.mapId) && !exits.has(`${x},${y}`);
    });
    if (d === undefined) return;
    this.walkTo({ x: position.x + STEP[d][0], y: position.y + STEP[d][1] });
    this.walkTo(position);
  }

  nextExitToward(targetMapId) {
    const start = this.state.mapId;
    const previous = new Map([[start, null]]);
    const queue = [start];
    while (queue.length) {
      const mapId = queue.shift();
      if (mapId === targetMapId) break;
      const map = chroniclesMapById(mapId);
      for (const exit of map.exits || []) {
        const effect = (exit.action?.effects || []).find((candidate) => candidate.type === 'transition-map');
        if (!effect || previous.has(effect.mapId)) continue;
        if (!this.requirementsMet(exit.requirements)) continue;
        previous.set(effect.mapId, { from: mapId, exit });
        queue.push(effect.mapId);
      }
    }
    if (!previous.has(targetMapId)) return null;
    let node = targetMapId;
    while (previous.get(node)?.from !== start) node = previous.get(node).from;
    return previous.get(node).exit;
  }

  requirementsMet(requirements = []) {
    return requirements.every((requirement) => {
      if (requirement.itemId) return (this.state.inventory?.[requirement.itemId]?.quantity || 0) >= (requirement.quantity || 1);
      if (requirement.questId) return this.state.quests?.[requirement.questId]?.status === (requirement.questStatus || 'active');
      const value = this.state[requirement.key];
      if ('equals' in requirement) return value === requirement.equals;
      if (requirement.truthy) return Boolean(value);
      if (requirement.falsy) return !value;
      return true;
    });
  }

  afterArrival() {
    // A fresh area: equip anything better that came from the last one, and
    // in a town spend the purse on upgrades like a careful player would.
    this.equipBest();
    const map = chroniclesMapById(this.state.mapId);
    if (map.regionKind === 'settlement' && !this.shoppedAt.has(map.id + this.shopVisitKey())) {
      this.shoppedAt.add(map.id + this.shopVisitKey());
      for (const entry of (map.interactables || []).filter((candidate) => candidate.shop)) this.shop(map, entry);
      for (const entry of (map.interactables || []).filter((candidate) => candidate.guild)) this.study(map, entry);
    }
  }

  // Revisit a town's shops only when the purse has grown enough to matter.
  shopVisitKey() {
    return `:${Math.floor(chroniclesGoldBalance(this.state) / 100)}`;
  }

  upgradesIn(stock) {
    const wants = [];
    for (const member of this.state.party.filter((hero) => hero.hp > 0)) {
      for (const slot of ['weapon', 'armor', 'shield']) {
        const current = chroniclesEquippedItem(this.state, member.id, slot);
        const owned = Object.keys(this.state.inventory || {}).map((itemId) => CHRONICLES_EQUIPMENT[itemId])
          .filter((item) => item && item.slot === slot && chroniclesMemberCanEquip(member, item));
        const score = (item) => itemScore(item, member);
        const have = Math.max(score(current), ...owned.map(score));
        const best = stock
          .map((itemId) => CHRONICLES_EQUIPMENT[itemId])
          .filter((item) => item && item.slot === slot && chroniclesMemberCanEquip(member, item) && score(item) > have)
          .sort((left, right) => score(right) - score(left) || left.price - right.price);
        if (best.length) wants.push({ member, slot, options: best, gain: score(best[0]) - have });
      }
    }
    return wants.sort((left, right) => right.gain - left.gain);
  }

  shop(map, entry) {
    const reserve = 24;
    if (entry.shop.stock.some((itemId) => POTION_KIT[itemId])) {
      this.stockPotions(map, entry, reserve);
      return;
    }
    if (!this.upgradesIn(entry.shop.stock).some((want) => want.options.some((item) => item.price <= chroniclesGoldBalance(this.state) - reserve))) return;
    const position = chroniclesMapContentPosition(map, entry);
    this.walkTo(position);
    while (this.state.initiative) this.fight();
    this.act('interact');
    if (!this.state.shop) return;
    let guard = 0;
    for (;;) {
      guard += 1;
      if (guard > 20) break;
      const budget = chroniclesGoldBalance(this.state) - reserve;
      const pick = this.upgradesIn(entry.shop.stock)
        .map((want) => want.options.find((item) => item.price <= budget))
        .find(Boolean);
      if (!pick) break;
      const before = chroniclesGoldBalance(this.state);
      this.state = chroniclesReduce(this.state, { type: 'shop-buy', itemId: pick.id });
      if (chroniclesGoldBalance(this.state) === before) break;
      this.purchases.push({ itemId: pick.id, price: pick.price, step: this.currentLabel });
      this.equipBest();
    }
    this.state = chroniclesReduce(this.state, { type: 'shop-close' });
  }

  // The spells this guild sells that someone alive could still learn, best first.
  spellWants(entry) {
    const sold = new Set(entry.guild.spells || []);
    return SPELL_PRIORITY.filter((spellId) => sold.has(spellId)).flatMap((spellId) => this.state.party
      .filter((member) => chroniclesGuildCanLearn(this.state, member, spellId))
      .map((member) => ({ member, spell: CHRONICLES_SPELLS[spellId] })));
  }

  study(map, entry) {
    // Keep enough for an inn night and a temple visit.
    const reserve = 40;
    const joined = chroniclesGuildMember(this.state, entry.id);
    const fee = joined ? 0 : Number(entry.guild.membership || 0);
    const first = this.spellWants(entry)[0];
    if (!first || chroniclesGoldBalance(this.state) - reserve < fee + first.spell.price) return;
    this.walkTo(chroniclesMapContentPosition(map, entry));
    while (this.state.initiative) this.fight();
    this.act('interact');
    if (!this.state.guild) return;
    if (!joined) this.state = chroniclesReduce(this.state, { type: 'guild-join' });
    for (let guard = 0; guard < 12; guard += 1) {
      const budget = chroniclesGoldBalance(this.state) - reserve;
      const pick = this.spellWants(entry).find((want) => want.spell.price <= budget);
      if (!pick) break;
      const before = chroniclesGoldBalance(this.state);
      this.state = chroniclesReduce(this.state, { type: 'guild-learn', memberId: pick.member.id, spellId: pick.spell.id });
      if (chroniclesGoldBalance(this.state) === before) break;
      this.learned.push({ memberId: pick.member.id, spellId: pick.spell.id, price: pick.spell.price, step: this.currentLabel });
    }
    this.state = chroniclesReduce(this.state, { type: 'guild-close' });
  }

  stockPotions(map, entry, reserve) {
    const wanted = () => Object.entries(POTION_KIT)
      .filter(([itemId, count]) => entry.shop.stock.includes(itemId) && chroniclesConsumableCount(this.state, itemId) < count)
      .map(([itemId]) => CHRONICLES_CONSUMABLES[itemId])
      .find((item) => item.price <= chroniclesGoldBalance(this.state) - reserve);
    if (!wanted()) return;
    this.walkTo(chroniclesMapContentPosition(map, entry));
    while (this.state.initiative) this.fight();
    this.act('interact');
    if (!this.state.shop) return;
    for (let guard = 0; guard < 8; guard += 1) {
      const pick = wanted();
      if (!pick) break;
      const before = chroniclesGoldBalance(this.state);
      this.state = chroniclesReduce(this.state, { type: 'shop-buy', itemId: pick.id });
      if (chroniclesGoldBalance(this.state) === before) break;
      this.purchases.push({ itemId: pick.id, price: pick.price, step: this.currentLabel });
    }
    this.state = chroniclesReduce(this.state, { type: 'shop-close' });
  }

  // ─── story actions ──────────────────────────────────────────────────────
  interact(mapId, id) {
    this.travelTo(mapId);
    const map = chroniclesMapById(mapId);
    const entry = ['interactables', 'treasures', 'triggers'].flatMap((group) => map[group] || []).find((candidate) => candidate.id === id);
    if (!entry) throw new BotError(`no content ${id} in ${mapId}`);
    const position = chroniclesMapContentPosition(map, entry);
    this.walkTo(position);
    while (this.state.initiative) this.fight();
    this.walkTo(position);
    // The real town doorway can open a room automatically while walking in.
    // Do not interact again just to dismiss/reopen that same inn.
    if (this.state.inn?.id === id) return;
    const before = fingerprint(this.state);
    this.act('interact');
    if (fingerprint(this.state) === before) {
      throw new BotError(`interaction ${id} in ${mapId} did nothing: «${this.state.message}»`);
    }
  }

  kill(mapId, enemyId) {
    this.travelTo(mapId);
    const enemy = chroniclesMapById(mapId).enemies.find((candidate) => candidate.id === enemyId);
    if (!enemy) throw new BotError(`no enemy ${enemyId} in ${mapId}`);
    this.engage(enemy);
    while (this.state.initiative) this.fight();
  }

  // Heal the way a player has to: walk to the nearest town and pay the
  // temple (raises the fallen) or the inn (also restores spell points).
  rest() {
    if (this.resting) return;
    this.resting = true;
    try {
      const anyDead = this.state.party.some((member) => member.hp <= 0);
      const service = this.nearestService(anyDead ? 'revive-party' : 'restore-spell-points')
        || this.nearestService('heal-party');
      if (!service) throw new BotError(`no healer reachable from ${this.state.mapId}`);
      while (this.state.initiative) this.fight();
      this.interact(service.mapId, service.entry.id);
      if (this.state.inn?.id === service.entry.id) {
        this.act({ type: 'inn-rest' });
        this.act({ type: 'inn-close' });
      }
      this.rests += 1;
      this.restGold += serviceCost(service.entry);
      if (anyDead && this.state.party.every((member) => member.hp > 0)) this.revives += 1;
      // A fallen hero raised by the temple still wants the inn's full night.
      if (this.state.party.some((member) => member.hp < member.maxHp * 0.6)) {
        const inn = this.nearestService('restore-spell-points');
        if (inn) {
          this.interact(inn.mapId, inn.entry.id);
          if (this.state.inn?.id === inn.entry.id) {
            this.act({ type: 'inn-rest' });
            this.act({ type: 'inn-close' });
          }
          this.restGold += serviceCost(inn.entry);
        }
      }
    } finally {
      this.resting = false;
      this.needsRest = false;
    }
  }

  nearestService(effectType) {
    const start = this.state.mapId;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const mapId = queue.shift();
      const map = chroniclesMapById(mapId);
      const entry = (map.interactables || []).find((candidate) => candidate.kind === 'service'
        && this.requirementsMet(candidate.when || [])
        && (candidate.action?.effects || []).some((effect) => effect.type === effectType)
        && (candidate.requirements || []).every((requirement) => !requirement.itemId || chroniclesGoldBalance(this.state) >= (requirement.quantity || 1)));
      if (entry) return { mapId, entry };
      for (const exit of map.exits || []) {
        const effect = (exit.action?.effects || []).find((candidate) => candidate.type === 'transition-map');
        if (!effect || seen.has(effect.mapId) || !this.requirementsMet(exit.requirements)) continue;
        seen.add(effect.mapId);
        queue.push(effect.mapId);
      }
    }
    return null;
  }

  hurt(threshold) {
    return this.state.party.some((member) => member.hp > 0 && member.hp < member.maxHp * threshold)
      || this.state.party.some((member) => member.hp <= 0);
  }

  restIfHurt(threshold = 0.6) {
    if (this.hurt(threshold)) this.rest();
  }

  // Mid-dungeon: a careful player turns back when the company is battered,
  // heals in town and comes back to where they were.
  retreatIfBattered() {
    if (this.resting || this.state.initiative || !this.needsRest) return false;
    const mapId = this.state.mapId;
    this.rest();
    this.travelTo(mapId);
    return true;
  }

  equipBest() {
    if (this.state.initiative || this.state.phase !== 'explore') return;
    for (const member of this.state.party.filter((hero) => hero.hp > 0)) {
      for (const slot of ['weapon', 'armor', 'shield']) {
        const current = chroniclesEquippedItem(this.state, member.id, slot);
        const owned = Object.keys(this.state.inventory || {})
          .map((itemId) => CHRONICLES_EQUIPMENT[itemId])
          .filter((item) => item && item.slot === slot && chroniclesMemberCanEquip(member, item));
        const best = owned.sort((left, right) => itemScore(right, member) - itemScore(left, member))[0];
        if (best && itemScore(best, member) > itemScore(current, member)) this.state = chroniclesEquipItem(this.state, member.id, best.id);
      }
    }
  }

  milestone(label) {
    this.milestones.push({
      label,
      actions: this.actions,
      gold: chroniclesGoldBalance(this.state),
      levels: Object.fromEntries(this.state.party.map((member) => [member.id, chroniclesHeroProgress(this.progression, member.id).level])),
      hp: Object.fromEntries(this.state.party.map((member) => [member.id, `${member.hp}/${member.maxHp}`])),
      ac: Object.fromEntries(this.state.party.map((member) => [member.id, chroniclesPartyArmorClass(this.state, member.id)])),
      toHit: Object.fromEntries(this.state.party.map((member) => {
        const stats = chroniclesPartyAttackStats(this.state, member.id);
        return [member.id, `${stats.toHit}:${stats.damage}`];
      })),
      fights: this.fights.length,
      deaths: this.deaths.length,
      rests: this.rests,
    });
  }
}

export { BotError, chroniclesMapIds, CHRONICLES_DIRECTIONS };
