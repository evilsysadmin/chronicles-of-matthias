import { useRef } from 'react';

/**
 * Keep party navigation distinct from opening a hero's dossier.
 * The first pointer click selects; the second opens the sheet. Enter on a
 * focused portrait is an explicit keyboard alternative. During spell target
 * choice the first click is owned by the spell and must never open a sheet.
 */
export default function ChroniclesPartyAvatarButton({
  children, onSelect, onOpen, onTarget, targeting = false, ...props
}) {
  const targetedOnFirstClick = useRef(false);
  const openedBySecondClick = useRef(false);
  const pointerType = useRef('');
  const lastTouchClickAt = useRef(0);
  const targetClickAt = useRef(0);

  const handleClick = (event) => {
    const touch = pointerType.current === 'touch' && event.detail > 0;
    pointerType.current = '';
    if (targeting) {
      targetedOnFirstClick.current = true;
      targetClickAt.current = event.timeStamp;
      lastTouchClickAt.current = 0;
      onTarget?.();
      return;
    }
    // A fast second click after choosing a spell target belongs to the spell,
    // not to an unrelated character sheet opened by its subsequent dblclick.
    if (targetedOnFirstClick.current && event.timeStamp - targetClickAt.current < 750) {
      targetedOnFirstClick.current = false;
      openedBySecondClick.current = true;
      return;
    }
    targetedOnFirstClick.current = false;

    const touchDoubleTap = touch && lastTouchClickAt.current > 0
      && event.timeStamp - lastTouchClickAt.current < 600;
    if (touch) lastTouchClickAt.current = event.timeStamp;
    if (event.detail >= 2 || touchDoubleTap) {
      // Browsers may dispatch click(clickCount=2) before dblclick; open once.
      lastTouchClickAt.current = 0;
      openedBySecondClick.current = true;
      onOpen?.();
      return;
    }
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