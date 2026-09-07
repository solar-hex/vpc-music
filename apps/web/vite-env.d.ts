/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SANDBOX?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_LOG_VERBOSE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by Vite from package.json (see vite.config.ts `define`). */
declare const __APP_VERSION__: string;
