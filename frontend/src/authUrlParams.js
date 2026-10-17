// Reads the one-shot auth values a link can carry (a reset token or an
// invitation code) and removes them from the address bar afterwards.
//
// Links get typed and pasted by hand, so the invite is accepted in every shape
// people actually write: ?invite=CODE, ?inviteCode=CODE, /invite=CODE,
// /invite/CODE and #invite=CODE. Values are percent-decoded but a literal "+"
// stays a "+": URLSearchParams would turn it into a space and break codes.

const QUERY_KEYS = { resetToken: ['resetToken'], inviteCode: ['invite', 'inviteCode'] };
const PATH_INVITE = /^\/invite(?:Code)?[=/](.+?)\/?$/;
const HASH_INVITE = /^#invite(?:Code)?=(.+)$/;

function decode(raw) {
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw;
  }
}

function queryValue(search, keys) {
  const query = String(search || '').replace(/^\?/, '');
  if (!query) return '';
  for (const part of query.split('&')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    if (keys.includes(decode(part.slice(0, at)))) {
      const value = decode(part.slice(at + 1)).trim();
      if (value) return value;
    }
  }
  return '';
}

export function authParamsFromLocation(location) {
  const resetToken = queryValue(location?.search, QUERY_KEYS.resetToken);
  let inviteCode = queryValue(location?.search, QUERY_KEYS.inviteCode);
  if (!inviteCode) {
    const match = String(location?.pathname || '').match(PATH_INVITE)
      || String(location?.hash || '').match(HASH_INVITE);
    if (match) inviteCode = decode(match[1]).trim();
  }
  return { resetToken, inviteCode };
}

// The address the page should show once the values are captured.
export function addressWithoutAuthParams(location) {
  const kept = String(location?.search || '').replace(/^\?/, '').split('&').filter((part) => {
    if (!part) return false;
    const at = part.indexOf('=');
    const key = decode(at < 0 ? part : part.slice(0, at));
    return !QUERY_KEYS.resetToken.includes(key) && !QUERY_KEYS.inviteCode.includes(key);
  });
  const pathname = PATH_INVITE.test(String(location?.pathname || '')) ? '/' : (location?.pathname || '/');
  const hash = HASH_INVITE.test(String(location?.hash || '')) ? '' : (location?.hash || '');
  return `${pathname}${kept.length ? `?${kept.join('&')}` : ''}${hash}`;
}
