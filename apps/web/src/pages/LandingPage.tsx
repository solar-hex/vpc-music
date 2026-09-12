import { Link, Navigate } from "react-router-dom";
import { Search, KeyRound, Smartphone, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";

const POINTS = [
  {
    icon: Search,
    title: "Search that keeps up",
    body: "The whole library in one box. Type a few letters of a title, an artist, or a line of the lyrics.",
  },
  {
    icon: KeyRound,
    title: "Any key, one tap",
    body: "Pick a key or nudge it a semitone. The chart follows, and the link remembers it.",
  },
  {
    icon: Smartphone,
    title: "Built for a music stand",
    body: "Big type, a dark theme for the platform, and the screen stays awake while you play.",
  },
  {
    icon: Printer,
    title: "Print or export",
    body: "Print a clean sheet, or take a song out as ChordPro, OnSong, text or PDF.",
  },
];

/**
 * The front door at `/`. Signed-in people never see it: they go straight to
 * the song list, which is the point of the app. It exists for someone who
 * lands on the bare domain without an account.
 */
export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/songs" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <ThemeToggleButton />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 sm:py-16">
        <div className="mb-12 flex items-center gap-3">
          <ThemedLogo className="h-11 w-11 rounded-lg" alt="" />
          <span className="text-lg font-semibold">VPC Music</span>
        </div>

        <h1 className="font-brand text-4xl leading-tight tracking-tight sm:text-5xl">Every chord chart, on the stand.</h1>
        <p className="mt-4 max-w-xl text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
          The worship team's song library. Find a song in a couple of letters, set the key you're playing in, and read it
          from your phone.
        </p>

        <div className="mt-9">
          <Link to="/login" className="btn-primary min-h-[3.25rem] px-8 py-3 text-base">
            Open VPC Music
          </Link>
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
            Team members sign in. Ask your worship leader for an invite.
          </p>
        </div>

        <ul className="mt-14 grid gap-6 border-t border-[hsl(var(--border))] pt-8 sm:grid-cols-2 sm:gap-x-10">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-[hsl(var(--secondary))]" aria-hidden="true" />
                {title}
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-10 text-sm text-[hsl(var(--muted-foreground))]">
        Valley Praise Church
      </footer>
    </div>
  );
}
