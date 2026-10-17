import { describe, expect, it } from 'vitest';
import { addressWithoutAuthParams, authParamsFromLocation } from './authUrlParams.js';

const at = (pathname, search = '', hash = '') => ({ pathname, search, hash });
const CODE = 'ab12__c+9@Z';

describe('authParamsFromLocation', () => {
  it.each([
    ['query', at('/', `?invite=${CODE}`)],
    ['query with inviteCode', at('/', `?inviteCode=${CODE}`)],
    ['encoded query', at('/', `?invite=${encodeURIComponent(CODE)}`)],
    ['path with =', at(`/invite=${CODE}`)],
    ['path with / and trailing slash', at(`/invite/${encodeURIComponent(CODE)}/`)],
    ['hash', at('/', '', `#invite=${CODE}`)],
  ])('reads the invite from the %s', (_, location) => {
    expect(authParamsFromLocation(location)).toEqual({ resetToken: '', inviteCode: CODE });
  });

  it('keeps a literal plus instead of turning it into a space', () => {
    expect(authParamsFromLocation(at('/', '?invite=a+b')).inviteCode).toBe('a+b');
  });

  it('reads a reset token and ignores unrelated addresses', () => {
    expect(authParamsFromLocation(at('/', '?resetToken=t0k'))).toEqual({ resetToken: 't0k', inviteCode: '' });
    expect(authParamsFromLocation(at('/', '', '#tactics'))).toEqual({ resetToken: '', inviteCode: '' });
    expect(authParamsFromLocation(at('/invitations'))).toEqual({ resetToken: '', inviteCode: '' });
  });
});

describe('addressWithoutAuthParams', () => {
  it('drops every invite shape but keeps the rest of the address', () => {
    expect(addressWithoutAuthParams(at('/', `?invite=${CODE}&lang=en`, '#tactics'))).toBe('/?lang=en#tactics');
    expect(addressWithoutAuthParams(at(`/invite=${CODE}`))).toBe('/');
    expect(addressWithoutAuthParams(at('/', '', `#invite=${CODE}`))).toBe('/');
    expect(addressWithoutAuthParams(at('/', '?resetToken=x'))).toBe('/');
    expect(addressWithoutAuthParams(at('/', '', '#tactics'))).toBe('/#tactics');
  });
});
