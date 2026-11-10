// Verify a staging playtest identity is unusable after the API reports deletion.
// Never log credentials or response bodies from the authentication endpoint.
export async function assertPlaytestAccountRevoked(fetchImpl, api, username, password) {
  const response = await fetchImpl(api + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.status !== 401) {
    throw new Error('BOT_ACCOUNT_REVOCATION_FAILED HTTP ' + response.status);
  }
}
