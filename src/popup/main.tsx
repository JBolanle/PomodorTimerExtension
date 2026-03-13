import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono";
import "@/styles/globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/toast";
import { AnnouncerProvider } from "@/components/Announcer";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AnnouncerProvider>
          <App />
        </AnnouncerProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
