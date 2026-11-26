import {describe,expect,it} from 'vitest';
import {chroniclesActiveEnemies,createChroniclesState} from '../chroniclesOfMatthias.js';
import {chroniclesResolveEnemyActor,chroniclesResolveEnemyTurn,chroniclesPreviewEnemyTurn} from '../chroniclesOfMatthiasTurns.js';

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
  expect(after.message).toContain(creature.name.charAt(0).toUpperCase()+creature.name.slice(1));
  for(const event of after.enemyTurnEvents){
   expect(event.fromHp-event.toHp).toBe(Math.min(event.fromHp,event.damage));
   const victim=before.party.find(hero=>hero.id===event.targetId);
   const lost=event.fromHp-event.toHp;
   const result=event.missed?'falla':lost>0?`−${lost} PV`:'sin daño';
   expect(after.message).toContain(`${event.attackName} a ${victim.name}: ${result}`);
  }
 });
 it('approaches one tile without a free bite or zarpazo',()=>{
  const before=setup(2);
  const after=chroniclesResolveEnemyActor(before,SPIDER);
  expect(after.enemyTurnEvents.map(e=>e.type)).toEqual(['move']);
  expect(after.party).toEqual(before.party);
  expect(after.message).toContain('se mueve; no ataca este turno.');
 });
 it('reports exact committed damage rather than nominal overkill',()=>{
  const base=createChroniclesState('menagerie-of-ash',null,{rules:'mm3'});
  const foes=chroniclesActiveEnemies(base);
  const hound=foes.find(enemy=>enemy.id==='bone-hound');
  expect(hound.retaliation).toBe(2);
  const encounter={...base,x:1,y:2,direction:0,phase:'combat',turnPhase:'enemy',
   ...Object.fromEntries(foes.filter(enemy=>enemy.id!==hound.id).map(enemy=>[enemy.hpKey,0])),
   enemyPositions:{[hound.id]:{x:1,y:1}},
   initiative:{round:1,cursor:0,order:[{kind:'enemy',id:hound.id},{kind:'party',id:'matthias'}]},
   party:base.party.map(hero=>({...hero,hp:1}))};
  let found=false;
  // The actual roll is keyed by runSeed/turns, not initiative.round.
  for(let seed=0;seed<100;seed++){
   const before={...encounter,runSeed:'hound-overkill-'+seed};
   const after=chroniclesResolveEnemyActor(before,hound.id);
   const overkill=after.enemyTurnEvents.find(e=>e.type==='attack'&&e.fromHp===1&&e.damage===2&&e.toHp===0);
   if(!overkill)continue;
   const victim=before.party.find(hero=>hero.id===overkill.targetId);
   expect(after.message).toContain(`Ataque a ${victim.name}: −1 PV (cae)`);
   expect(after.message).not.toContain('−2 PV');
   found=true;
   break;
  }
  expect(found).toBe(true);
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

describe('Enemy intent preview includes complete multiattack receipts', () => {
 it('matches both actual strikes without mutating state or replacing legacy fields',()=>{
  const before=setup();
  const snapshot=JSON.stringify(before);
  const actual=chroniclesResolveEnemyTurn(before).enemyTurnEvents;
  expect(actual).toHaveLength(2);
  const preview=chroniclesPreviewEnemyTurn(before);
  const intent=preview.intents.find(e=>e.enemyId===SPIDER);
  expect(intent).toMatchObject({kind:'attack',targetId:actual[0].targetId,damage:actual[0].damage,hpLost:actual[0].fromHp-actual[0].toHp});
  expect(intent.strikes).toEqual(actual.map(event=>({
   targetId:event.targetId,attackName:event.attackName,damage:event.damage,
   hpLost:event.fromHp-event.toHp,lethal:event.toHp===0,missed:Boolean(event.missed),
  })));
  expect(preview.attackedMemberIds).toEqual([...new Set(actual.map(event=>event.targetId))]);
  expect(JSON.stringify(before)).toBe(snapshot);
 });
 it('includes a second victim after the first target falls',()=>{
  const base=setup();
  const encounter={...base,party:base.party.map(hero=>({...hero,hp:1}))};
  let found=false;
  for(let seed=0;seed<100;seed++){
   const before={...encounter,runSeed:'preview-spider-'+seed};
   const actual=chroniclesResolveEnemyTurn(before).enemyTurnEvents.filter(e=>e.type==='attack');
   if(actual.length!==2||actual[0].toHp!==0||actual[0].targetId===actual[1].targetId)continue;
   const preview=chroniclesPreviewEnemyTurn(before);
   expect(preview.attackedMemberIds).toEqual(actual.map(e=>e.targetId));
   expect(preview.intents[0].strikes.map(e=>e.targetId)).toEqual(actual.map(e=>e.targetId));
   found=true;
   break;
  }
  expect(found).toBe(true);
 });
});
