import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { ChordProEditor } from "@/components/songs/ChordProEditor";
import { MemoryRouter } from "react-router-dom";
import { SettingsProfileTab } from "@/pages/settings/SettingsProfileTab";
import { SettingsPreferencesTab } from "@/pages/settings/SettingsPreferencesTab";

expect.extend(toHaveNoViolations as Parameters<typeof expect.extend>[0]);

vi.mock("@vpc-music/shared", () => ({
  CHORD_REGEX: /^[A-G][b#]?(?:m|min|maj|dim|aug|sus[24]?|add)?[2-9]?(?:\/[A-G][b#]?)?$/,
  transposeChord: (chord: string, _steps: number) => `${chord}#`,
  parseChordPro: (content: string) => ({
    directives: { title: "Test" },
    sections: [{ name: "Verse 1", lines: [{ chords: [], lyrics: content.slice(0, 50) }] }],
  }),
  transposeChordPro: (content: string) => content,
  chordToNashville: (chord: string) => chord,
  roleLabel: (role: string) => (role === "admin" ? "Worship Leader" : role),
}));

const mockRefreshUser = vi.fn();
const mockGetSettings = vi.fn();
const mockListUsers = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", displayName: "John", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "admin" }] },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    contrastMode: "normal",
    editorMode: "advanced",
    themePreset: "custom",
    chordColor: "#ca9762",
    secondaryChordColor: "#8b5cf6",
    pageBackground: "#f8f9fa",
    songFontFamily: "mono",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    setContrastMode: vi.fn(),
    toggleContrastMode: vi.fn(),
    setEditorMode: vi.fn(),
    setThemePreset: vi.fn(),
    setChordColor: vi.fn(),
    setSecondaryChordColor: vi.fn(),
    setPageBackground: vi.fn(),
    setSongFontFamily: vi.fn(),
  }),
  EDITOR_MODE_OPTIONS: [
    { value: "beginner", label: "Beginner", description: "Beginner description" },
    { value: "advanced", label: "Advanced", description: "Advanced description" },
  ],
  SONG_FONT_OPTIONS: [
    { value: "mono", label: "Monospace", description: "Mono description" },
  ],
  THEME_PRESETS: {
    "stage-dark": {
      theme: "dark",
      contrastMode: "normal",
      chordColor: "#7dd3fc",
      secondaryChordColor: "#c084fc",
      pageBackground: "#000435",
      songFontFamily: "mono",
    },
    "print-light": {
      theme: "light",
      contrastMode: "normal",
      chordColor: "#b91c1c",
      secondaryChordColor: "#7c3aed",
      pageBackground: "#ffffff",
      songFontFamily: "mono",
    },
    classic: {
      theme: "light",
      contrastMode: "normal",
      chordColor: "#ca9762",
      secondaryChordColor: "#8b5cf6",
      pageBackground: "#f8f9fa",
      songFontFamily: "mono",
    },
  },
  THEME_PRESET_OPTIONS: [
    { value: "custom", label: "Custom", description: "Custom description" },
    { value: "stage-dark", label: "Stage Dark", description: "Stage dark description" },
    { value: "print-light", label: "Print Light", description: "Print light description" },
    { value: "classic", label: "Classic", description: "Classic description" },
  ],
}));

vi.mock("@/lib/api-client", () => ({
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
  },
  orgsApi: {
    update: vi.fn(),
    remove: vi.fn(),
  },
  platformApi: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    updateSettings: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("Accessibility audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ settings: {} });
    mockListUsers.mockResolvedValue({ users: [{ id: "u1" }, { id: "u2" }] });
  });

  it("ChordProEditor has no obvious accessibility violations", async () => {
    const { container } = render(
      <ChordProEditor
        value={"{title: Test}\n{comment: Verse 1}\n[G]Amazing grace\n\n{comment: Chorus}\n[C]How sweet"}
        onChange={vi.fn()}
        metadata={{ title: "Test", key: "G" }}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Settings profile tab has no obvious accessibility violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsProfileTab />
      </MemoryRouter>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Settings preferences tab has no obvious accessibility violations", async () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsPreferencesTab />
      </MemoryRouter>,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});