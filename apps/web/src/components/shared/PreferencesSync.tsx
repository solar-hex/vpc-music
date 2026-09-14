import { useEffect, useRef } from "react";
import { platformApi } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { isPageWidth } from "@/lib/page-width";

/**
 * Apply account-level appearance preferences (theme, chord colours, key
 * spelling, page width) once per sign-in, on every page, so they no longer depend on
 * visiting Settings.
 */
export function PreferencesSync() {
  const { user } = useAuth();
  const { setTheme, setChordColor, setSecondaryChordColor, setKeyNotation, setPageWidth } = useTheme();
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    platformApi
      .getSettings()
      .then(({ settings }) => {
        if (settings.theme === "light" || settings.theme === "dark" || settings.theme === "system") setTheme(settings.theme);
        if (typeof settings.chordColor === "string") setChordColor(settings.chordColor);
        if (typeof settings.secondaryChordColor === "string") setSecondaryChordColor(settings.secondaryChordColor);
        if (settings.keyNotation === "sharps" || settings.keyNotation === "flats") setKeyNotation(settings.keyNotation);
        if (isPageWidth(settings.pageWidth)) setPageWidth(settings.pageWidth);
      })
      .catch(() => {
        // Preferences are a nicety; the locally stored ones already apply.
      });
  }, [user, setTheme, setChordColor, setSecondaryChordColor, setKeyNotation, setPageWidth]);

  return null;
}
