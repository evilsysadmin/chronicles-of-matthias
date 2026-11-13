import { useRef } from 'react';

// Touch selection survives a slow paint: the selected hero's next touch
// opens its dossier, even when the browser takes over 600 ms to render.
export function chroniclesSecondTouchOpensSheet({ touch, previouslyTouched, selected }) {
  return touch && previouslyTouched && selected;
}

/**
 * Keep party navigation distinct from opening a hero's dossier.
 * The first pointer click selects; the second opens the sheet. Enter on a
 * focused portrait is an explicit keyboard alternative. A second tap on
 * the selected hero opens the sheet without a timeout. During spell target
 * choice the first click is owned by the spell and must never open a sheet.
 */
export default function ChroniclesPartyAvatarButton({
  children, onSelect, onOpen, onTarget, targeting = false, ...props
}) {
  const targetedOnFirstClick = useRef(false);
  const openedBySecondClick = useRef(false);
  const pointerType = useRef('');
  const previouslyTouched = useRef(false);
  const targetClickAt = useRef(0);

  const handleClick = (event) => {
    const touch = pointerType.current === 'touch';
    pointerType.current = '';
    if (targeting) {
      targetedOnFirstClick.current = true;
      targetClickAt.current = event.timeStamp;
      previouslyTouched.current = false;
      onTarget?.();
      return;
    }
    // A fast second click after choosing a spell target belongs to the spell,
    // not to an unrelated character sheet opened by its subsequent dblclick.
    if (targetedOnFirstClick.current && event.timeStamp - targetClickAt.current < 750) {
      targetedOnFirstClick.current = false;
      previouslyTouched.current = false;
      openedBySecondClick.current = true;
      return;
    }
    targetedOnFirstClick.current = false;

    const secondTouch = chroniclesSecondTouchOpensSheet({
      touch,
      previouslyTouched: previouslyTouched.current,
      selected: props['aria-pressed'] === true,
    });
    if (event.detail >= 2 || secondTouch) {
      // Browsers may dispatch click(clickCount=2) before dblclick; open once.
      previouslyTouched.current = false;
      openedBySecondClick.current = true;
      onOpen?.();
      return;
    }
    previouslyTouched.current = touch;
    openedBySecondClick.current = false;
    onSelect?.();
  };

  const handleDoubleClick = () => {
    if (targeting || targetedOnFirstClick.current || openedBySecondClick.current) {
      targetedOnFirstClick.current = false;
      openedBySecondClick.current = false;
      return;
    }
    onOpen?.();
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.repeat || targeting) return;
    event.preventDefault();
    event.stopPropagation();
    onOpen?.();
  };

  return (
    <button type="button" {...props}
      onPointerDown={(event) => { pointerType.current = event.pointerType; }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >{children}</button>
  );
}