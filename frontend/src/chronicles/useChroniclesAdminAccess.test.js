import { describe, expect, it } from 'vitest';
import { chroniclesAdminAccessFromMe } from './useChroniclesAdminAccess.js';

describe('Chronicles admin authorization recovery', () => {
  it('recognizes only explicit true isAdmin returned by a successful API verification', () => {
    expect(chroniclesAdminAccessFromMe({ status: 'ok', user: { username: 'evilsysadmin', isAdmin: true } }))
      .toEqual({ isAdmin: true, status: 'verified' });
    for (const user of [
      { username: 'evilsysadmin' },
      { username: 'evilsysadmin', isAdmin: false },
      { username: 'evilsysadmin', isAdmin: 'true' },
      { username: 'evilsysadmin', admin: true },
      null,
    ]) {
      expect(chroniclesAdminAccessFromMe({ status: 'ok', user }))
        .toEqual({ isAdmin: false, status: 'verified' });
    }
  });

  it('fails closed on unavailable and unauthorized sessions, allowing retry only for transient failures', () => {
    expect(chroniclesAdminAccessFromMe({ status: 'unavailable', user: { isAdmin: true } }))
      .toEqual({ isAdmin: false, status: 'unavailable' });
    expect(chroniclesAdminAccessFromMe({ status: 'unauthorized', user: { isAdmin: true } }))
      .toEqual({ isAdmin: false, status: 'denied' });
    expect(chroniclesAdminAccessFromMe({ status: 'error' }))
      .toEqual({ isAdmin: false, status: 'unavailable' });
    expect(chroniclesAdminAccessFromMe(null))
      .toEqual({ isAdmin: false, status: 'unavailable' });
  });
});
