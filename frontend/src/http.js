import { withRequestId, requestErrorMessage } from './requestId.js';
import { DEFAULT_REQUEST_TIMEOUT_MS } from './requestTimeout.js';
import { userFacingError } from './userFacingError.js';
import { notifySessionExpired } from './sessionExpiry.js';

export { DEFAULT_REQUEST_TIMEOUT_MS } from './requestTimeout.js';

function requestAbortGuard(signal, timeoutMs) {
  const duration = Number(timeoutMs);
  const useTimeout = Number.isFinite(duration) && duration > 0;
  if (!useTimeout && !signal) return { signal: undefined, cleanup() {}, timedOut: () => false };

  const controller = new AbortController();
  let timeoutId = null;
  let didTimeout = false;
  const forwardAbort = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  if (useTimeout) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, duration);
  }

  return {
    signal: controller.signal,
    timedOut: () => didTimeout,
    cleanup() {
      if (timeoutId !== null) clearTimeout(timeoutId);
      signal?.removeEventListener?.('abort', forwardAbort);
    },
  };
}

export async function request(url, options = {}) {
  const {
    headers = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal: externalSignal,
    ...rest
  } = options;
  const guard = requestAbortGuard(externalSignal, timeoutMs);
  try {
    return await fetch(url, { ...rest, headers: withRequestId(headers), signal: guard.signal });
  } catch (cause) {
    const timeoutCause = guard.timedOut()
      ? new Error(`Request timeout after ${Math.round(Number(timeoutMs))} ms`)
      : cause;
    if (guard.timedOut()) timeoutCause.name = 'TimeoutError';
    const error = new Error(userFacingError(timeoutCause));
    error.cause = timeoutCause;
    error.name = timeoutCause?.name || error.name;
    error.timedOut = guard.timedOut();
    throw error;
  } finally {
    guard.cleanup();
  }
}

function hasAuthorizationHeader(headers) {
  if (!headers) return false;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) return headers.some(([key]) => String(key).toLowerCase() === 'authorization');
  return Object.keys(headers).some((key) => String(key).toLowerCase() === 'authorization');
}

// These answer 401 for a wrong *current password* while the session itself
// is fine; they must not log the player out.
const PASSWORD_CHECK_RE = /\/auth\/(?:password|email|delete-account)(?:[?#]|$)/;

async function parseJsonResponse(response, { authenticatedRequest = false, url = '' } = {}) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { message, requestId } = requestErrorMessage(response, body);
    const error = new Error(message);
    error.status = response.status;
    error.requestId = requestId;
    error.body = body;
    error.technicalMessage = message;
    error.authenticatedRequest = authenticatedRequest;
    error.message = userFacingError(error, message);
    if (response.status === 401 && authenticatedRequest && !PASSWORD_CHECK_RE.test(String(url))) notifySessionExpired();
    throw error;
  }
  return body;
}

// With a ShadowOps account the game token lives an hour: before a 401 logs
// the player out, renew it once from the SSO cookie and retry.
let sessionRefresher = null;
export function setSessionRefresher(refresher) {
  sessionRefresher = typeof refresher === 'function' ? refresher : null;
}

function withAuthorization(headers, token) {
  const plainHeaders = Object.fromEntries(
    Object.entries(headers || {}).filter(([key]) => String(key).toLowerCase() !== 'authorization'),
  );
  return { ...plainHeaders, Authorization: `Bearer ${token}` };
}

export async function requestJson(url, options = {}) {
  const authenticatedRequest = hasAuthorizationHeader(options?.headers);
  const response = await request(url, options);
  const plainHeaders = !(typeof Headers !== 'undefined' && options?.headers instanceof Headers) && !Array.isArray(options?.headers);
  if (response.status === 401 && authenticatedRequest && sessionRefresher && plainHeaders
    && !PASSWORD_CHECK_RE.test(String(url)) && !(typeof options.body === 'object' && options.body?.getReader)) {
    const fresh = await sessionRefresher().catch(() => null);
    if (fresh) {
      return parseJsonResponse(
        await request(url, { ...options, headers: withAuthorization(options.headers, fresh) }),
        { authenticatedRequest, url },
      );
    }
  }
  return parseJsonResponse(response, { authenticatedRequest, url });
}
