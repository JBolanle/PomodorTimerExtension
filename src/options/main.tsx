import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jetbrains-mono';
import '@/styles/globals.css';
import { AnnouncerProvider } from '@/components/Announcer';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>
  </StrictMode>
);
