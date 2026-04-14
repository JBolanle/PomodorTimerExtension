// Composed root provider stack mounted at both popup and options roots.
// Keeps the nesting order in one place so popup and options don't
// drift.

import type { ReactNode } from 'react';
import { FocusModeProvider } from './FocusModeContext';
import { SettingsProvider } from './SettingsContext';
import { ThemeProvider } from './ThemeContext';
import { TimerStateProvider } from './TimerStateContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TimerStateProvider>
      <SettingsProvider>
        <ThemeProvider>
          <FocusModeProvider>{children}</FocusModeProvider>
        </ThemeProvider>
      </SettingsProvider>
    </TimerStateProvider>
  );
}
