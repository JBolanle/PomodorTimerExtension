import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono";
import "@/styles/globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/toast";
import { AnnouncerProvider } from "@/components/Announcer";
import { AppProviders } from "@/contexts/Providers";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AnnouncerProvider>
          <AppProviders>
            <App />
          </AppProviders>
        </AnnouncerProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
