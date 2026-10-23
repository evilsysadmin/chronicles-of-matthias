import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  chroniclesAreaTravelKeyDecision,
  chroniclesBindAreaTravelFocus,
} from '../chronicles/chroniclesAreaTransitionFocus.js';
import './ChroniclesAreaTransition.css';

// One real modal shared by the adventure and the browser regression fixture.
// No separate selected state: the focused action is the selected action.
export default function ChroniclesAreaTransitionDialog({ question, onAccept, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const acceptRef = useRef(null);

  useEffect(() => chroniclesBindAreaTravelFocus(dialogRef.current, document), []);

  const onKeyDown = (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Tab') {
      const cancel = cancelRef.current, accept = acceptRef.current;
      if (event.shiftKey && document.activeElement === cancel) {
        event.preventDefault();
        accept?.focus();
      } else if (!event.shiftKey && document.activeElement === accept) {
        event.preventDefault();
        cancel?.focus();
      }
      // Retain regular Tab movement between the two modal actions.
      event.stopPropagation();
      return;
    }
    const decision = chroniclesAreaTravelKeyDecision(
      event.key, document.activeElement === acceptRef.current ? 'accept' : 'cancel',
    );
    if (!decision) {
      // The doorway is a true modal: gameplay hotkeys (notably S to shoot)
      // and vertical movement may not leak to the expedition behind it.
      // Preserve ordinary browser/assistive Tab and modified shortcuts.
      if (['ArrowUp', 'ArrowDown', 's', 'S', 'a', 'A'].includes(event.key)) {
        event.preventDefault();
      }
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (decision === 'focus-cancel') cancelRef.current?.focus();
    else if (decision === 'focus-accept') acceptRef.current?.focus();
    else if (decision === 'cancel') onCancel();
    else if (decision === 'accept') onAccept();
  };

  return createPortal(
    <div className="chronicles-area-transition" data-chronicles-area-transition role="presentation">
      <section ref={dialogRef} className="chronicles-area-transition__card"
        role="dialog" aria-modal="true"
        aria-labelledby="chronicles-area-transition-title"
        aria-describedby="chronicles-area-transition-hint"
        onKeyDown={onKeyDown}>
        <h2 id="chronicles-area-transition-title">{question}</h2>
        <div className="chronicles-area-transition__actions">
          <button ref={cancelRef} type="button" data-area-transition-cancel onClick={onCancel}>
            No
          </button>
          <button ref={acceptRef} type="button" data-area-transition-accept onClick={onAccept}>
            Sí
          </button>
        </div>
        <p id="chronicles-area-transition-hint">← / → elegir · Enter confirmar · Esc cancelar</p>
      </section>
    </div>, document.body,
  );
}
