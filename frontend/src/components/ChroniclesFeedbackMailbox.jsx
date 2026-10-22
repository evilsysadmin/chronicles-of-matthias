import { useEffect, useRef, useState } from 'react';
import {
  CHRONICLES_FEEDBACK_CATEGORIES, prepareChroniclesFeedback,
  readChroniclesFeedback, sendChroniclesFeedback,
} from '../chronicles/chroniclesFeedbackMailbox.js';
import './ChroniclesFeedbackMailbox.css';

const CATEGORY_LABELS = CHRONICLES_FEEDBACK_CATEGORIES;
function characterCount(message) { return [...message].length; }

// A page inside the existing adventure folio, not a second stacked modal.
// The expedition continues unchanged; no automatic game state, logs, location
// or screenshots are transmitted.
export default function ChroniclesFeedbackMailbox({ onBack, draft, onDraftChange }) {
  const [category, setCategory] = useState('bug');
  // A parent can retain the draft when this nested page unmounts on Back.
  // Standalone usage still works through the local fallback.
  const [localMessage, setLocalMessage] = useState('');
  const message = draft === undefined ? localMessage : draft;
  const setMessage = onDraftChange || setLocalMessage;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef(null);
  const backRef = useRef(null);
  const count = characterCount(message);
  const valid = count >= 3 && count <= 2000;

  useEffect(() => {
    inputRef.current?.focus();
    return () => {};
  }, []);

  function handleEscape(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    onBack?.();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || !valid) return;
    setError('');
    setBusy(true);
    try {
      const payload = prepareChroniclesFeedback(category, message);
      await sendChroniclesFeedback(payload.category, payload.message);
      setSent(true);
      setMessage('');
      // The list is never a synthetic success; let the next read fetch
      // the real persisted record from Mongo.
      setHistory(null);
    } catch (failure) {
      setError(failure?.message || 'No se ha podido enviar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history !== null || historyBusy) return;
    setHistoryBusy(true);
    setError('');
    try {
      setHistory(await readChroniclesFeedback());
    } catch (failure) {
      setError(failure?.message || 'No se han podido consultar tus mensajes.');
      setHistoryOpen(false);
    } finally {
      setHistoryBusy(false);
    }
  }

  return (
    <section className="chronicles-feedback-mailbox" aria-labelledby="chronicles-feedback-heading"
      data-chronicles-feedback-mailbox onKeyDown={handleEscape}>
      <div className="chronicles-feedback-mailbox__top">
        <button type="button" className="chronicles-feedback-mailbox__back"
          onClick={onBack} disabled={busy} ref={backRef}>← Volver al menú</button>
        <span aria-hidden="true">✉</span>
      </div>
      <h3 id="chronicles-feedback-heading">Buzón de feedback</h3>
      <p>¿Un bug, una idea o algo que mejorar? Escríbelo aquí. Nos llegará directamente.</p>
      <p className="chronicles-feedback-mailbox__privacy">Se envían únicamente tu mensaje, la categoría y tu usuario. No adjuntamos capturas ni datos de tu partida.</p>

      {sent && (
        <p role="status" className="chronicles-feedback-mailbox__success">
          Mensaje enviado. ¡Gracias por ayudarnos a mejorar Chronicles!
        </p>
      )}
      {error && <p role="alert" className="chronicles-feedback-mailbox__error">{error}</p>}
      <form onSubmit={submit} className="chronicles-feedback-mailbox__form">
        <label htmlFor="chronicles-feedback-category">¿Sobre qué quieres escribir?</label>
        <select id="chronicles-feedback-category" value={category}
          onChange={(event) => { setCategory(event.target.value); setSent(false); }}
          disabled={busy}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="chronicles-feedback-message">Tu mensaje</label>
        <textarea id="chronicles-feedback-message" ref={inputRef}
          value={message} rows={4} maxLength={2000}
          onChange={(event) => { setMessage(event.target.value); setSent(false); setError(''); }}
          placeholder="Cuéntanos qué ha pasado o qué cambiarías…"
          disabled={busy} required aria-describedby="chronicles-feedback-count" />
        <small id="chronicles-feedback-count">{count}/2000 caracteres · mínimo 3</small>
        <button type="submit" className="chronicles-feedback-mailbox__send"
          disabled={!valid || busy}>{busy ? 'Enviando…' : 'Enviar mensaje'}</button>
      </form>

      <button type="button" className="chronicles-feedback-mailbox__history-toggle"
        onClick={() => void toggleHistory()} disabled={historyBusy}>
        {historyOpen ? 'Ocultar mis mensajes' : 'Consultar mis mensajes'}
      </button>
      {historyOpen && (
        <div className="chronicles-feedback-mailbox__history" aria-live="polite">
          {historyBusy && <p>Consultando buzón…</p>}
          {!historyBusy && history?.length === 0 && <p>Aún no has enviado mensajes.</p>}
          {!historyBusy && history?.map((entry) => (
            <article key={entry.id} className="chronicles-feedback-mailbox__entry">
              <header>
                <b>{CATEGORY_LABELS[entry.category] || 'Mensaje'}</b>
                <small>{entry.status === 'resolved' ? 'Resuelto' : entry.admin_reply ? 'Respondido' : 'Recibido'}</small>
              </header>
              <p>{entry.message}</p>
              {entry.admin_reply && <blockquote><b>Respuesta:</b> {entry.admin_reply}</blockquote>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
