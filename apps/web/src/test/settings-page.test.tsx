import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SettingsPage } from "@/pages/settings/SettingsPage";

// ---------- Mocks ----------
const mockRefreshUser = vi.fn();
const mockLogout = vi.fn();
let mockAuthValue: any;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const themeSetters = {
  setTheme: vi.fn(),
  toggleTheme: vi.fn(),
  setKeyNotation: vi.fn(),
  setPageWidth: vi.fn(),
  setChordColor: vi.fn(),
  setSecondaryChordColor: vi.fn(),
  resetChordColors: vi.fn(),
};
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    keyNotation: "flats",
    pageWidth: "centered",
    chordColor: "#ca9762",
    secondaryChordColor: "#8b5cf6",
    ...themeSetters,
  }),
}));

const mockUpdateSettings = vi.fn();
const mockUpdateProfile = vi.fn();
const mockChangePassword = vi.fn();
const mockExportZip = vi.fn();
const mockListUsers = vi.fn();
vi.mock("@/lib/api-client", () => ({
  platformApi: {
    getSettings: vi.fn().mockResolvedValue({ settings: {} }),
    updateSettings: (...args: any[]) => mockUpdateSettings(...args),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    changePassword: (...args: any[]) => mockChangePassword(...args),
  },
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
    invite: vi.fn(),
    inviteBulk: vi.fn(),
    resendInvite: vi.fn(),
    updateRole: vi.fn(),
    removeMember: vi.fn(),
  },
  orgsApi: { update: vi.fn() },
  songsApi: { exportZip: (...args: any[]) => mockExportZip(...args) },
}));

vi.mock("@/hooks/useSongLibrary", () => ({
  useSongLibrary: () => ({
    songs: [
      { id: "s1", title: "Amazing Grace", content: "" },
      { id: "s2", title: "Be Thou My Vision", content: "" },
    ],
    loading: false,
    error: null,
    offline: false,
    refresh: vi.fn(),
  }),
  invalidateSongLibrary: vi.fn(),
}));

vi.mock("@/components/songs/ImportSongsDialog", () => ({
  ImportSongsDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="import-dialog">import dialog</div> : null),
}));

vi.mock("@/components/layout/ChangelogDialog", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="changelog-dialog">
      <button onClick={onClose}>Close changelog</button>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function adminAuth() {
  return {
    user: { id: "u1", displayName: "John", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "admin" }] },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    refreshUser: mockRefreshUser,
    logout: mockLogout,
  };
}

function renderPage(path = "/settings") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const scrolledTo: string[] = [];
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthValue = adminAuth();
  mockListUsers.mockResolvedValue({ users: [] });
  mockUpdateSettings.mockResolvedValue({ settings: {} });
  scrolledTo.length = 0;
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolledTo.push(this.id);
  };
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe("SettingsPage", () => {
  it("shows every section with pill anchors for an admin", async () => {
    renderPage();
    for (const name of ["Profile", "Appearance", "Team", "Data", "About"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${name.toLowerCase()}`);
    }
    expect(screen.getByText(/Test Church · Worship Leader/)).toBeInTheDocument();
    await waitFor(() => expect(mockListUsers).toHaveBeenCalled());
  });

  it("hides the Team section from musicians", () => {
    mockAuthValue = { ...adminAuth(), activeOrg: { id: "org1", name: "Test Church", role: "musician" } };
    renderPage();
    expect(screen.queryByRole("heading", { level: 2, name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("scrolls to the section named in the hash", async () => {
    renderPage("/settings#team");
    await waitFor(() => expect(scrolledTo).toContain("team"));
  });

  describe("profile", () => {
    it("shows the email read-only and saves the display name", async () => {
      mockUpdateProfile.mockResolvedValue({ user: {} });
      renderPage();
      const user = userEvent.setup();
      expect(screen.getByLabelText("Email")).toBeDisabled();
      expect(screen.getByLabelText("Email")).toHaveValue("john@test.com");
      await user.clear(screen.getByLabelText("Display name"));
      await user.type(screen.getByLabelText("Display name"), "Johnny");
      await user.click(screen.getByRole("button", { name: "Save profile" }));
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: "Johnny" });
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });

    it("rejects an empty display name", async () => {
      const { toast } = await import("sonner");
      renderPage();
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText("Display name"));
      await user.click(screen.getByRole("button", { name: "Save profile" }));
      expect(toast.error).toHaveBeenCalledWith("Display name is required");
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it("changes the password when both entries match", async () => {
      mockChangePassword.mockResolvedValue({ message: "ok" });
      renderPage();
      fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass123" } });
      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass1234" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "newpass1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith({ currentPassword: "oldpass123", newPassword: "newpass1234" });
      });
    });

    it("refuses mismatched passwords", async () => {
      const { toast } = await import("sonner");
      renderPage();
      fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "oldpass123" } });
      fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass1234" } });
      fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different1234" } });
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      expect(toast.error).toHaveBeenCalledWith("Passwords don't match");
      expect(mockChangePassword).not.toHaveBeenCalled();
    });
  });

  describe("appearance", () => {
    it("switches the theme on the device and on the account", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Light" }));
      expect(themeSetters.setTheme).toHaveBeenCalledWith("light");
      expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: "light" });
    });

    it("switches the key spelling", () => {
      renderPage();
      expect(screen.getByRole("button", { name: "Flats (Gb)" })).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(screen.getByRole("button", { name: "Sharps (F#)" }));
      expect(themeSetters.setKeyNotation).toHaveBeenCalledWith("sharps");
      expect(mockUpdateSettings).toHaveBeenCalledWith({ keyNotation: "sharps" });
    });

    it("keeps pages centered by default and lets the account choose full width", () => {
      renderPage();
      expect(screen.getByRole("group", { name: "Page width" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Centered" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Full width" })).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(screen.getByRole("button", { name: "Full width" }));
      expect(themeSetters.setPageWidth).toHaveBeenCalledWith("full");
      expect(mockUpdateSettings).toHaveBeenCalledWith({ pageWidth: "full" });
    });

    it("changes and resets the chord colours", () => {
      renderPage();
      fireEvent.change(screen.getByLabelText("Chord colour"), { target: { value: "#123456" } });
      expect(themeSetters.setChordColor).toHaveBeenCalledWith("#123456");
      expect(mockUpdateSettings).toHaveBeenCalledWith({ chordColor: "#123456" });
      fireEvent.change(screen.getByLabelText("Secondary chord colour"), { target: { value: "#654321" } });
      expect(themeSetters.setSecondaryChordColor).toHaveBeenCalledWith("#654321");
      fireEvent.click(screen.getByRole("button", { name: "Reset colours" }));
      expect(themeSetters.resetChordColors).toHaveBeenCalled();
      expect(mockUpdateSettings).toHaveBeenCalledWith({ chordColor: "#ca9762", secondaryChordColor: "#8b5cf6" });
      expect(screen.getByTestId("appearance-preview")).toHaveTextContent("Amazing grace");
    });
  });

  describe("data", () => {
    it("opens the import dialog for editors", () => {
      renderPage();
      expect(screen.queryByTestId("import-dialog")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /import songs/i }));
      expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
    });

    it("hides import from observers", () => {
      mockAuthValue = { ...adminAuth(), activeOrg: { id: "org1", name: "Test Church", role: "observer" } };
      renderPage();
      expect(screen.queryByRole("button", { name: /import songs/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /download library/i })).toBeInTheDocument();
    });

    it("downloads the whole library as a zip in the chosen format", async () => {
      const createObjectURL = vi.fn(() => "blob:library");
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      mockExportZip.mockResolvedValue({ ok: true, blob: async () => new Blob(["zip"]) });
      renderPage();
      expect(screen.getByText(/2 songs/)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Download format"), { target: { value: "onsong" } });
      fireEvent.click(screen.getByRole("button", { name: /download library/i }));
      await waitFor(() => expect(mockExportZip).toHaveBeenCalledWith(["s1", "s2"], "onsong"));
      await waitFor(() => expect(click).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:library");
      click.mockRestore();
    });

    it("reports a failed download", async () => {
      const { toast } = await import("sonner");
      mockExportZip.mockResolvedValue({ ok: false, status: 500 });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /download library/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Download failed"));
    });
  });

  describe("about", () => {
    it("shows the version and opens the changelog", async () => {
      renderPage();
      expect(screen.getByText("VPC Music 0.0.0-test")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /what's new/i }));
      expect(await screen.findByTestId("changelog-dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close changelog" }));
      expect(screen.queryByTestId("changelog-dialog")).not.toBeInTheDocument();
    });

    it("signs out and returns to the login page", async () => {
      mockLogout.mockResolvedValue(undefined);
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
      await waitFor(() => expect(mockLogout).toHaveBeenCalled());
      expect(await screen.findByText("login page")).toBeInTheDocument();
    });
  });
});
