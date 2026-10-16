import { useEffect } from 'react';

// Standalone Chronicles adapter. The source modal keeps its unchanged hook
// contract; Chess Studio's global navigation stack/browser history is not
// imported into this independent app.
export function useEscapeToClose(onClose, { disabled = false, contextMenu = false } = {}) {
  useEffect(() => {
    if (disabled || typeof window === 'undefined' || typeof onClose !== 'function') return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    // Capture ensures modal Escape beats any parent page keyboard controls.
    window.addEventListener('keydown', closeOnEscape, true);
    if (!contextMenu) return () => window.removeEventListener('keydown', closeOnEscape, true);
    const closeOnContextMenu = (event) => {
      if (event.pointerType === 'touch') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('contextmenu', closeOnContextMenu, true);
    return () => {
      window.removeEventListener('keydown', closeOnEscape, true);
      window.removeEventListener('contextmenu', closeOnContextMenu, true);
    };
  }, [onClose, disabled, contextMenu]);
}
