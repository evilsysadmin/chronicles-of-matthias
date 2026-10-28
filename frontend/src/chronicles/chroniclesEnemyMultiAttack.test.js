import {describe,expect,it} from 'vitest';
import {chroniclesActiveEnemies,createChroniclesState} from '../chroniclesOfMatthias.js';
import {chroniclesResolveEnemyActor,chroniclesResolveEnemyTurn} from '../chroniclesOfMatthiasTurns.js';

const SPIDER='crypt-spider';
function setup(distance=1){
 const state=createChroniclesState('menagerie-of-ash',null,{rules:'mm3'});
 const enemies=chroniclesActiveEnemies(state);
 return {...state,
  ...Object.fromEntries(enemies.filter(e=>e.id!==SPIDER).map(e=>[e.hpKey,0])),
  x:3,y:3+distance,direction:0,phase:'combat',turnPhase:'enemy',
  enemyPositions:{[SPIDER]:{x:3,y:3}},
  initiative:{round:1,cursor:0,order:[{kind:'enemy',id:SPIDER},{kind:'party',id:'matthias'}]},
 };
}
describe('MM3 multiattack spider: one turn, separate strikes',()=>{
 it('performs bite then leg strike as distinct independent rolls, without advancing initiative',()=>{
  const before=setup();
  const creature=chroniclesActiveEnemies(before).find(e=>e.id===SPIDER);
  expect(creature.attacks).toEqual(['Mordisco','Zarpazo']);
  const after=chroniclesResolveEnemyActor(before,SPIDER);
  expect(after.enemyTurnEvents.map(e=>e.type)).toEqual(['attack','attack']);
  expect(after.enemyTurnEvents.map(e=>e.attackName)).toEqual(['Mordisco','Zarpazo']);
  expect(after.enemyTurnEvents.map(e=>e.attackIndex)).toEqual([0,1]);
  expect(after.enemyTurnEvents.every(e=>e.attackCount===2)).toBe(true);
  expect(after.enemyTurnEvents.every(e=>Number.isInteger(e.roll)&&e.roll>=1&&e.roll<=20)).toBe(true);
  expect(after.initiative).toEqual(before.initiative);
  expect(after.party.reduce((n,m)=>n+m.hp,0)).toBeLessThanOrEqual(
   before.party.reduce((n,m)=>n+m.hp,0));
  for(const event of after.enemyTurnEvents)
   expect(event.fromHp-event.toHp).toBe(Math.min(event.fromHp,event.damage));
 });
 it('approaches one tile without a free bite or zarpazo',()=>{
  const before=setup(2);
  const after=chroniclesResolveEnemyActor(before,SPIDER);
  expect(after.enemyTurnEvents.map(e=>e.type)).toEqual(['move']);
  expect(after.party).toEqual(before.party);
 });
 it('paralysis cancels the full attack sequence',()=>{
  const before=setup();
  const after=chroniclesResolveEnemyActor({...before,enemyStatus:{[SPIDER]:{paralyzed:1}}},SPIDER);
  expect(after.enemyTurnEvents.map(e=>e.type)).toEqual(['paralyzed']);
  expect(after.party).toEqual(before.party);
 });
 it('collective enemy resolver follows the same authored two-hit budget',()=>{
  const before=setup();
  const after=chroniclesResolveEnemyTurn(before);
  expect(after.enemyTurnEvents.map(e=>e.attackName)).toEqual(['Mordisco','Zarpazo']);
  expect(after.round).toBe(Number(before.round||0)+1);
 });
 it('normal creatures preserve single-hit action economy',()=>{
  const before=createChroniclesState('swordhaven-sewers',null,{rules:'mm3'});
  const goblin=chroniclesActiveEnemies(before).find(e=>e.id==='sewers-goblin-west');
  expect(goblin.attacks).toBeUndefined();
 });
});
