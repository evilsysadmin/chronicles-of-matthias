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

  const handleClick = (event) => {
    if (targeting) {
      targetedOnFirstClick.current = true;
      onTarget?.();
      return;
    }
    if (event.detail >= 2) {
      // Chrome may dispatch click(clickCount=2) before dblclick. Open once.
      if (targetedOnFirstClick.current) {
        targetedOnFirstClick.current = false;
        return;
      }
      openedBySecondClick.current = true;
      onOpen?.();
      return;
    }
    targetedOnFirstClick.current = false;
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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >{children}</button>
  );
}
