import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from '@/components/layout/Sidebar';
import { SettingsPage } from './pages/SettingsPage';
import { TimerPage } from './pages/TimerPage';
import { HistoryPage } from './pages/HistoryPage';

export default function App() {
  useTheme();

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/timer" replace />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
