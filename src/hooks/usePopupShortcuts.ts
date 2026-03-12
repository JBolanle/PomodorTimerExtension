import { useEffect } from 'react';

interface PopupShortcutHandlers {
  onToggle: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function usePopupShortcuts({
  onToggle,
  onSkip,
  onReset,
}: PopupShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onToggle();
          break;
        case 'KeyS':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onSkip();
          }
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onReset();
          }
          break;
        case 'Escape':
          window.close();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToggle, onSkip, onReset]);
}
