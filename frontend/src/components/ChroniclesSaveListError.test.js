import { describe, expect, it } from 'vitest';
import { chroniclesSaveListErrorMessage } from './ChroniclesOfMatthias.jsx';

describe('Chronicles · save list errors', () => {
  it('tells an expired session apart from a server error or no answer', () => {
    expect(chroniclesSaveListErrorMessage({ status: 401 })).toMatch(/sesión ha caducado/);
    expect(chroniclesSaveListErrorMessage({ status: 503, requestId: 'abcdef1234567890' }))
      .toBe('No se pudo consultar el servidor (error 503 · ref. abcdef123456). Se muestran los guardados locales; pulsa «Reintentar sincronización».');
    expect(chroniclesSaveListErrorMessage(new TypeError('Failed to fetch'))).toMatch(/\(sin respuesta\)/);
  });
});
