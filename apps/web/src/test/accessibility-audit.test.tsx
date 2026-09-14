import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { ChordProEditor } from "@/components/songs/ChordProEditor";
import { SettingsPage } from "@/pages/settings/SettingsPage";

expect.extend(toHaveNoViolations as Parameters<typeof expect.extend>[0]);

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  parseBarLine: () => ({ measures: [] }),
  CHORD_REGEX: /^[A-G][b#]?(?:m|min|maj|dim|aug|sus[24]?|add)?[2-9]?(?:\/[A-G][b#]?)?$/,
  transposeChord: (chord: string, _steps: number) => `${chord}#`,
  parseChordPro: (content: string) => ({
    directives: { title: "Test" },
    sections: [{ name: "Verse 1", lines: [{ chords: [], lyrics: content.slice(0, 50) }] }],
  }),
  transposeChordPro: (content: string) => content,
  chordToNashville: (chord: string) => chord,
  roleLabel: (role: string) => (role === "admin" ? "Worship Leader" : role),
  ROLE_DESCRIPTIONS: {
    admin: "Runs the team.",
    musician: "Edits songs.",
    observer: "Reads charts.",
  },
}));

const mockListUsers = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", displayName: "John", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "admin" }] },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    refreshUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    keyNotation: "flats",
    chordColor: "#ca9762",
    secondaryChordColor: "#8b5cf6",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    setKeyNotation: vi.fn(),
    setChordColor: vi.fn(),
    setSecondaryChordColor: vi.fn(),
    resetChordColors: vi.fn(),
  }),
}));

vi.mock("@/lib/api-client", () => ({
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
    invite: vi.fn(),
    inviteBulk: vi.fn(),
    resendInvite: vi.fn(),
    updateRole: vi.fn(),
    removeMember: vi.fn(),
  },
  orgsApi: { update: vi.fn() },
  platformApi: {
    getSettings: vi.fn().mockResolvedValue({ settings: {} }),
    updateSettings: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
  songsApi: { exportZip: vi.fn() },
}));

vi.mock("@/hooks/useSongLibrary", () => ({
  useSongLibrary: () => ({ songs: [{ id: "s1", title: "Amazing Grace", content: "" }], loading: false, error: null, offline: false, refresh: vi.fn() }),
  invalidateSongLibrary: vi.fn(),
}));

vi.mock("@/components/songs/ImportSongsDialog", () => ({
  ImportSongsDialog: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("Accessibility audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue({
      users: [
        { id: "u1", email: "john@test.com", displayName: "John", globalRole: "member", orgRole: "admin", hasPassword: true, createdAt: "" },
        { id: "u2", email: "pat@test.com", displayName: "Pat", globalRole: "member", orgRole: "musician", hasPassword: false, createdAt: "" },
      ],
    });
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

  // Each tab is its own screen now, so each one is audited, tabs included.
  it.each(["profile", "appearance", "team", "data", "about"])(
    "Settings %s tab has no obvious accessibility violations",
    async (tab) => {
      const { container, getByRole, getByText } = render(
        <MemoryRouter initialEntries={[`/settings#${tab}`]}>
          <SettingsPage />
        </MemoryRouter>,
      );
      expect(getByRole("tabpanel")).toBeInTheDocument();
      if (tab === "team") await waitFor(() => expect(getByText("Pat")).toBeInTheDocument());

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
    30_000,
  );
});
