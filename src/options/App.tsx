import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Sidebar } from '@/components/layout/Sidebar';
import { SettingsPage } from './pages/SettingsPage';
import { TimerPage } from './pages/TimerPage';
import { HistoryPage } from './pages/HistoryPage';

export default function App() {
  useTheme();
  const connected = useConnectionStatus();

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          {!connected && (
            <div
              role="alert"
              className="px-4 py-2 text-sm text-amber-700 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between"
            >
              <span>Connection to extension lost</span>
              <button
                onClick={() => window.location.reload()}
                className="underline font-medium hover:text-amber-900"
              >
                Reload
              </button>
            </div>
          )}
          <main className="flex-1 p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/timer" replace />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
