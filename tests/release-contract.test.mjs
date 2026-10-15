import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseCandidate } from '../scripts/release-contract.mjs';
const valid = { repository:'evilsysadmin/chronicles-of-matthias',service:'chronicles-api',sha:'a'.repeat(40),digest:'sha256:'+'b'.repeat(64),environment:'staging' };
test('accepts only pinned Chronicles staging candidates', () => {
 assert.deepEqual(validateReleaseCandidate(valid),valid);
 for (const [field,value] of [['repository','evilsysadmin/chess-studio'],['service','chess-api'],['sha','main'],['digest','latest'],['environment','production'],['command','unauthorized']]) {
  assert.throws(()=>validateReleaseCandidate({...valid,[field]:value}),field);
 }
});
