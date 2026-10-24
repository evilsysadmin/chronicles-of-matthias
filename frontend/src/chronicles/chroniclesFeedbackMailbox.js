import { authHeader } from '../auth.js';
import { requestJson } from '../http.js';

// Chronicles' *own* API. No Chess Studio endpoint, screenshots or saved-game
// data is uploaded. Authentication and SSO refresh are handled by requestJson.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const FEEDBACK_URL = `${BASE_URL.replace(/\/$/, '')}/feedback`;
export const CHRONICLES_FEEDBACK_CATEGORIES = Object.freeze({
  bug: 'Informar de un bug',
  idea: 'Proponer una idea',
  ux: 'Experiencia de juego',
  other: 'Otro',
});

export function prepareChroniclesFeedback(category, message) {
  if (!Object.hasOwn(CHRONICLES_FEEDBACK_CATEGORIES, category)) {
    throw new Error('Selecciona una categoría válida.');
  }
  const clean = typeof message === 'string' ? message.trim() : '';
  const size = [...clean].length;
  if (size < 3) throw new Error('Escribe al menos tres caracteres.');
  if (size > 2000) throw new Error('El mensaje no puede superar 2000 caracteres.');
  return { category, message: clean, context: 'Chronicles · Menú de aventura' };
}

export function sendChroniclesFeedback(category, message) {
  return requestJson(FEEDBACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(prepareChroniclesFeedback(category, message)),
    timeoutMs: 20000,
  });
}

export async function readChroniclesFeedback() {
  const result = await requestJson(`${FEEDBACK_URL}/mine`, {
    headers: { ...authHeader() },
    timeoutMs: 20000,
  });
  return Array.isArray(result?.feedback) ? result.feedback : [];
}
