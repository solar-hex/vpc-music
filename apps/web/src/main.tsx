import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { router } from "./router";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ConnectivityProvider } from "./contexts/ConnectivityContext";
import { PreferencesSync } from "./components/shared/PreferencesSync";
import { OfflineLibrarySync } from "./components/shared/OfflineLibrarySync";
import "./styles/index.css";

// Register service worker — auto-update on new content
registerSW({ immediate: true });

/** Toaster wrapper that reads the current resolved theme */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
        },
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ConnectivityProvider>
        <ThemeProvider>
          <PreferencesSync />
          <OfflineLibrarySync />
          <RouterProvider router={router} />
          <ThemedToaster />
        </ThemeProvider>
      </ConnectivityProvider>
    </AuthProvider>
  </StrictMode>
);
