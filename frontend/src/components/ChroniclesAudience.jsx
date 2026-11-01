import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import aldricIllustrated from '../assets/chronicles/ui/shops/aldric-hall-illustrated.svg';
import braskIllustrated from '../assets/chronicles/ui/shops/brask-watch-illustrated.svg';
import ilseTemple from '../assets/chronicles/ui/shops/ilse-temple.svg';
import { CHRONICLES_ALDRIC_HALL_PREMIUM_ART_URL, CHRONICLES_BRASK_WATCH_PREMIUM_ART_URL, CHRONICLES_ILSE_TEMPLE_PREMIUM_ART_URL } from '../chronicles/chroniclesShopArt.js';
import { ShopRoomArtwork } from './ChroniclesShop.jsx';
import './ChroniclesShop.css';
import './ChroniclesAudience.css';

const ROOM_ART = Object.freeze({
  'aldric-hall': Object.freeze({
    src: CHRONICLES_ALDRIC_HALL_PREMIUM_ART_URL,
    fallbackSrc: aldricIllustrated,
    alt: 'El alcalde Aldric, ante la mesa de su despacho en el ayuntamiento',
  }),
  'watch-house': Object.freeze({
    src: CHRONICLES_BRASK_WATCH_PREMIUM_ART_URL,
    fallbackSrc: braskIllustrated,
    alt: 'El sargento Brask, armado ante el mapa del cuartel',
  }),
  temple: Object.freeze({
    src: CHRONICLES_ILSE_TEMPLE_PREMIUM_ART_URL,
    fallbackSrc: ilseTemple,
    alt: 'La sacerdotisa Ilse ante el altar del templo',
  }),
});

export default function ChroniclesAudience({ dialogue, onAction, onClose }) {
  const firstChoiceRef = useRef(null);
  const [reply, setReply] = useState('');
  const [actionTaken, setActionTaken] = useState(false);
  const choices = dialogue?.choices?.filter((choice) => !actionTaken || choice.kind !== 'action') || [];
  const room = ROOM_ART[dialogue?.room] || null;

  const choose = (choice) => {
    if (!choice || choice.disabled) return;
    if (choice.kind === 'leave') {
      onClose();
      return;
    }
    if (choice.kind === 'say') {
      setReply(choice.answer);
      return;
    }
    if (choice.kind === 'temple-service') {
      const message = onAction(choice.serviceId, 'temple-service');
      setReply(message || 'Ilse no puede atender esta petición ahora mismo.');
      return;
    }
    if (choice.kind === 'action') {
      // The authoritative reducer (not dialogue UI) applies quest effects.
      const message = onAction(choice.actionId);
      setReply(message || 'El interlocutor asiente sin añadir nada.');
      setActionTaken(true);
    }
  };

  useEffect(() => {
    firstChoiceRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Tab') return; // Preserve normal focus traversal.
      // Only the audience handles keys while it is open. Never let 1-4
      // select heroes or W/arrow move the expedition behind the dialogue.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      const digit = Number(event.key);
      if (/^[1-9]$/.test(event.key) && digit <= choices.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        choose(choices[digit - 1]);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'f', 'F', ' '].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [choices, onClose, onAction]);

  if (!dialogue) return null;

  const modal = (
    <div className="chronicles-shop__backdrop" onClick={onClose}>
      <section className="chronicles-shop chronicles-audience"
        role="dialog" aria-modal="true"
        aria-label={`Conversación con ${dialogue.name}`}
        data-chronicles-audience={dialogue.id}
        data-chronicles-audience-spoken={actionTaken ? 'true' : 'false'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chronicles-shop__head chronicles-audience__head">
          <div>
            <span>CONVERSACIÓN · {dialogue.place}</span>
            <h2>{dialogue.name}</h2>
            <p>Elige una respuesta tocándola o pulsando su número.</p>
          </div>
          <button type="button" className="chronicles-shop__close" onClick={onClose}
            aria-label="Salir de la conversación">✕</button>
        </header>

        <figure className="chronicles-audience__scene" data-chronicles-audience-room={dialogue.room}>
          {room ? (
            <ShopRoomArtwork key={room.src} room={room} onCancel={onClose} />
          ) : (
            <div className="chronicles-audience__scene-fallback" aria-hidden="true">✦</div>
          )}
        </figure>

        <div className="chronicles-audience__dialogue">
          <small>{reply ? `${dialogue.name.toUpperCase()} RESPONDE` : 'AUDIENCIA'}</small>
          <p data-chronicles-dialogue-answer aria-live="polite">{reply || dialogue.greeting}</p>
          {dialogue.treasury && <p className="chronicles-audience__wallet" data-chronicles-temple-gold>
            {dialogue.treasury}
            {dialogue.blessingTurns > 0 ? ` · Bendición: ${dialogue.blessingTurns} acciones restantes` : ''}
          </p>}
          <div className="chronicles-audience__actions" aria-label="Respuestas disponibles">
            {choices.map((choice, index) => (
              <button ref={index === 0 ? firstChoiceRef : undefined} key={choice.id}
                type="button" data-chronicles-dialogue-choice={choice.id}
                disabled={choice.disabled === true} title={choice.reason || undefined}
                onClick={() => choose(choice)}>
                <b aria-hidden="true">{index + 1}.</b>
                <span>{choice.label}{choice.disabled && choice.reason
                  ? <small className="chronicles-audience__choice-reason"> · {choice.reason}</small> : null}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
  // The first-person world creates its own high-z stacking context. A modal
  // inside that context can end up *behind* the world even at z-index: 10150.
  // Match merchant/inn behavior: render the entire audience in document.body.
  // SSR retains plain markup for rendering and accessibility tests.
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
