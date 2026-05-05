/**
 * OAuth popup helper - opens the Google login in a centered popup window
 * and listens for the postMessage callback from the server.
 *
 * Usage:
 *   const result = await openOAuthPopup("google");
 *   // result = { success: true, token: "...", user: {...} }
 */

const API_ORIGIN = import.meta.env.VITE_API_URL || "";

function buildApiUrl(path: string) {
  const normalizedPath = API_ORIGIN && path.startsWith("/api/") ? path.slice(4) : path;
  return `${API_ORIGIN}${normalizedPath}`;
}

export interface OAuthResult {
  success: boolean;
  token?: string;
  user?: Record<string, unknown>;
  error?: string;
  status?: number;
}

export function openOAuthPopup(provider: "google"): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    // Build trusted origins (in dev, API may be on a different port)
    const trustedOrigins = new Set([window.location.origin]);
    if (API_ORIGIN) {
      try {
        trustedOrigins.add(new URL(API_ORIGIN).origin);
      } catch {
        /* ignore bad URL */
      }
    }

    const popup = window.open(
      buildApiUrl(`/api/auth/${provider}`),
      `vpc-oauth-${provider}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    let settled = false;

    // BroadcastChannel handles the case where COOP severs window.opener during the Google flow
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("vpc_oauth");
      bc.addEventListener("message", (event: MessageEvent) => {
        if (event.data?.type !== "VPC_OAUTH_CALLBACK") return;
        settle(event.data as OAuthResult);
      });
    } catch {
      /* BroadcastChannel not supported — fall through to postMessage */
    }

    // Fallback: postMessage from the popup when opener is still accessible
    function onMessage(event: MessageEvent) {
      if (!trustedOrigins.has(event.origin)) return;
      if (event.data?.type !== "VPC_OAUTH_CALLBACK") return;
      settle(event.data as OAuthResult);
    }

    // Poll for popup close (COOP may block .closed; catch and ignore if so)
    const closeTimer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(closeTimer);
          settle({ success: false });
        }
      } catch {
        clearInterval(closeTimer);
        settle({ success: false });
      }
    }, 500);

    function settle(result: OAuthResult) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function cleanup() {
      clearInterval(closeTimer);
      window.removeEventListener("message", onMessage);
      if (bc) {
        bc.close();
        bc = null;
      }
    }

    window.addEventListener("message", onMessage);
  });
}
