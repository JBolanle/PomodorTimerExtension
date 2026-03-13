import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isActive: boolean, onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Defer initial focus to next frame so React children are flushed
    const rafId = requestAnimationFrame(() => {
      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      focusableElements[0]?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      // Re-query in case DOM changed
      const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return containerRef;
}
