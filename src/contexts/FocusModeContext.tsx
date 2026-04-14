// Focus-mode context — shared cache of focus-mode settings and the
// current active/blocking status. The SW is the source of truth for
// both; this provider just centralizes the reads so individual
// components don't each fire their own `getFocusModeSettings` /
// `getFocusModeStatus` messages.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { sendMessage } from '@/lib/messaging/client';
import type { FocusModeSettings, FocusModeStatus } from '@/shared/types';

interface FocusModeContextValue {
  settings: FocusModeSettings | null;
  status: FocusModeStatus | null;
  updateSettings: (patch: Partial<FocusModeSettings>) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const FocusModeContext = createContext<FocusModeContextValue | null>(null);

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FocusModeSettings | null>(null);
  const [status, setStatus] = useState<FocusModeStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendMessage('getFocusModeSettings')
      .then((res) => {
        if (!cancelled) setSettings(res.settings);
      })
      .catch(() => {
        // SW may not be ready yet — consumers treat null as "unknown".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<FocusModeSettings>) => {
      await sendMessage('updateFocusModeSettings', { settings: patch });
      // Re-read so we reflect whatever defaults the SW merged in.
      const res = await sendMessage('getFocusModeSettings');
      setSettings(res.settings);
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const res = await sendMessage('getFocusModeStatus');
      setStatus(res);
    } catch {
      setStatus({ active: false, blockedCount: 0, temporaryAllows: [] });
    }
  }, []);

  return (
    <FocusModeContext.Provider
      value={{ settings, status, updateSettings, refreshStatus }}
    >
      {children}
    </FocusModeContext.Provider>
  );
}

export function useFocusModeContext(): FocusModeContextValue {
  const ctx = useContext(FocusModeContext);
  if (ctx === null) {
    throw new Error('useFocusMode must be used within a FocusModeProvider.');
  }
  return ctx;
}
