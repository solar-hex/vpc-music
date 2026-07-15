import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { openOAuthPopup } from "@/lib/oauth-popup";
import { authApi } from "@/lib/api-client";
import { toast } from "sonner";

const IS_SANDBOX = import.meta.env.VITE_SANDBOX === "true";

const SANDBOX_ACCOUNTS = [
  { label: "Admin", desc: "Worship Leader — full access", email: "worship-leader@vpc.church", password: "password123" },
  { label: "Musician", desc: "Band member — can edit", email: "keys@vpc.church", password: "password123" },
  { label: "Observer", desc: "View only — read access", email: "guitar@vpc.church", password: "password123" },
] as const;

// Inline Google "G" icon (multi-colour)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function LoginPage() {
  const { login, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(!!inviteEmail);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (needsPassword) {
        // First-time set-password flow
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        await authApi.setPassword(email, password);
        await refreshUser();
        toast.success("Password set. Welcome!");
        navigate("/dashboard");
      } else {
        // Normal login - first send email only to check needsPassword
        await login(email, password);
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      const body = err?.body;
      if (body?.needsPassword) {
        setNeedsPassword(true);
        setDisplayName(body.displayName || "");
        setPassword("");
      } else {
        toast.error(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      const result = await openOAuthPopup("google");
      if (result.success && result.user) {
        await refreshUser();
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else if (result.error) {
        setModalMessage(result.error);
      } else {
        // User closed popup without completing
      }
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setOauthLoading(false);
    }
  };

  const anyLoading = loading || oauthLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4">
      <ThemeToggleButton />
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-lg">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <ThemedLogo className="h-16 w-16 rounded-lg" />
          <h1 className="text-2xl font-brand text-[hsl(var(--secondary))]">
            VPC Music
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Sign in to your account
          </p>
        </div>

        {/* Google OAuth button */}
        <button
          type="button"
          disabled={anyLoading}
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
        >
          {oauthLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[hsl(var(--border))]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">
              or
            </span>
          </div>
        </div>

        {/* Email toggle / form */}
        {!showEmailForm ? (
          <button
            type="button"
            disabled={anyLoading}
            onClick={() => setShowEmailForm(true)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            Sign in with email
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {needsPassword && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Welcome{displayName ? `, ${displayName}` : ""}! Set a password to finish setting up your account.
              </p>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[hsl(var(--foreground))]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={needsPassword}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  {needsPassword ? "New password" : "Password"}
                </label>
                {!needsPassword && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[hsl(var(--secondary))] hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                minLength={needsPassword ? 8 : undefined}
                autoComplete={needsPassword ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                placeholder={needsPassword ? "At least 8 characters" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
              />
            </div>

            {needsPassword && (
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                  placeholder="Re-enter password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={anyLoading}
              className="w-full rounded-md bg-[hsl(var(--secondary))] px-4 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? needsPassword ? "Setting password..." : "Signing in..."
                : needsPassword ? "Set password and sign in" : "Sign in"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Link
            to="/"
            className="text-[hsl(var(--secondary))] hover:underline"
          >
            ← Back to home
          </Link>
        </p>

        {/* Sandbox quick-login buttons */}
        {IS_SANDBOX && (
          <div className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
            <div className="flex items-center gap-2 justify-center">
              <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Sandbox
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Quick login as:
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SANDBOX_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  disabled={anyLoading}
                  onClick={() => {
                    setEmail(acct.email);
                    setPassword(acct.password);
                    setShowEmailForm(true);
                    setNeedsPassword(false);
                  }}
                  className="flex flex-col items-center gap-0.5 rounded-md border border-[hsl(var(--border))] px-2 py-2 text-center hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
                >
                  <span className="text-xs font-medium text-[hsl(var(--foreground))]">{acct.label}</span>
                  <span className="text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">{acct.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite-only error modal */}
      {modalMessage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sign-in error"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Unable to sign in</h2>
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{modalMessage}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setModalMessage(null)}
              className="mt-5 w-full rounded-md bg-[hsl(var(--secondary))] px-4 py-2 text-sm font-medium text-[hsl(var(--secondary-foreground))] hover:opacity-90 transition-opacity"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
