import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('../contracts/run-api.json',import.meta.url)));
test('pins authenticated Chronicles run endpoints without claiming implementation',()=>{
 assert.equal(contract.schemaVersion,1);
 assert.equal(contract.routes.length,5);
 assert.deepEqual(contract.routes.map(r=>r.method),['POST','GET','GET','DELETE','PUT']);
 assert.ok(contract.routes.every(r=>r.auth));
 assert.equal(contract.routes.find(r=>r.method==='DELETE').successStatus,204);
 assert.ok(contract.requirements.some(r=>r.includes('owner-scoped')));
});
