import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const AnnouncerContext = createContext<((text: string) => void) | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');

  const announce = useCallback((text: string) => {
    setMessage('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMessage(text);
      });
    });
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  const announce = useContext(AnnouncerContext);
  if (!announce) {
    throw new Error('useAnnounce must be used within AnnouncerProvider');
  }
  return announce;
}
