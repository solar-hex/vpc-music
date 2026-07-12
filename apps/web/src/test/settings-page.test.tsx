import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SettingsProfileTab } from "@/pages/settings/SettingsProfileTab";
import { SettingsPreferencesTab } from "@/pages/settings/SettingsPreferencesTab";
import { AdminOrganizationTab } from "@/pages/admin/AdminOrganizationTab";

// ---------- Mocks ----------
const mockRefreshUser = vi.fn();
let mockAuthValue: any = {
  user: { id: "u1", displayName: "John", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "admin" }] },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
  refreshUser: mockRefreshUser,
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const mockSetTheme = vi.fn();
const mockSetContrastMode = vi.fn();
const mockSetEditorMode = vi.fn();
const mockSetThemePreset = vi.fn();
const mockSetChordColor = vi.fn();
const mockSetSecondaryChordColor = vi.fn();
const mockSetPageBackground = vi.fn();
const mockSetSongFontFamily = vi.fn();
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: mockSetTheme,
    contrastMode: "normal",
    setContrastMode: mockSetContrastMode,
    editorMode: "advanced",
    setEditorMode: mockSetEditorMode,
    themePreset: "custom",
    setThemePreset: mockSetThemePreset,
    chordColor: "#ca9762",
    setChordColor: mockSetChordColor,
    secondaryChordColor: "#8b5cf6",
    setSecondaryChordColor: mockSetSecondaryChordColor,
    pageBackground: "#f8f9fa",
    setPageBackground: mockSetPageBackground,
    songFontFamily: "mono",
    setSongFontFamily: mockSetSongFontFamily,
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

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockUpdateProfile = vi.fn();
const mockChangePassword = vi.fn();
const mockUpdateOrg = vi.fn();
const mockRemoveOrg = vi.fn();
const mockListOrgs = vi.fn();

vi.mock("@/lib/api-client", () => ({
  orgsApi: {
    list: (...args: any[]) => mockListOrgs(...args),
    update: (...args: any[]) => mockUpdateOrg(...args),
    remove: (...args: any[]) => mockRemoveOrg(...args),
  },
  platformApi: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    updateSettings: (...args: any[]) => mockUpdateSettings(...args),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    changePassword: (...args: any[]) => mockChangePassword(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderProfile() {
  return render(
    <MemoryRouter>
      <SettingsProfileTab />
    </MemoryRouter>,
  );
}

function renderPreferences() {
  return render(
    <MemoryRouter>
      <SettingsPreferencesTab />
    </MemoryRouter>,
  );
}

function renderOrganization() {
  return render(
    <MemoryRouter>
      <AdminOrganizationTab />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthValue = {
    user: { id: "u1", displayName: "John", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "admin" }] },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
    refreshUser: mockRefreshUser,
  };
  mockGetSettings.mockResolvedValue({ settings: {} });
  mockUpdateSettings.mockResolvedValue({ settings: {} });
  mockListOrgs.mockResolvedValue({ organizations: [{ id: "org1", name: "Test Church", slug: "test-church", logoUrl: null }] });
  mockUpdateOrg.mockResolvedValue({ organization: { id: "org1", name: "Renamed Church" } });
  mockRemoveOrg.mockResolvedValue({ message: "deleted" });
});

describe("SettingsProfileTab", () => {
  it("renders Profile section with email and display name", () => {
    renderProfile();
    expect(screen.getByLabelText("Email")).toHaveValue("john@test.com");
    expect(screen.getByLabelText("Display Name")).toHaveValue("John");
  });

  it("renders Change Password section", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
  });

  it("shows organization info and user ID", () => {
    renderProfile();
    expect(screen.getByText(/Organization: Test Church/)).toBeInTheDocument();
    expect(screen.getByText(/User ID: u1/)).toBeInTheDocument();
  });

  it("saves profile on submit", async () => {
    mockUpdateProfile.mockResolvedValue({ user: {} });
    renderProfile();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Display Name"));
    await user.type(screen.getByLabelText("Display Name"), "Johnny");
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: "Johnny" });
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it("changes password on submit", async () => {
    mockChangePassword.mockResolvedValue({ message: "ok" });
    renderProfile();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass1234");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass1234");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({ currentPassword: "oldpass123", newPassword: "newpass1234" });
    });
  });

  it("disables email field", () => {
    renderProfile();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("shows error when display name is empty", async () => {
    const { toast } = await import("sonner");
    renderProfile();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Display Name"));
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    expect(toast.error).toHaveBeenCalledWith("Display name is required");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("shows error when passwords don't match", async () => {
    const { toast } = await import("sonner");
    renderProfile();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass1234");
    await user.type(screen.getByLabelText("Confirm New Password"), "different1234");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(toast.error).toHaveBeenCalledWith("Passwords don't match");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows error on profile update failure", async () => {
    const { toast } = await import("sonner");
    mockUpdateProfile.mockRejectedValue(new Error("Server error"));
    renderProfile();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});

describe("SettingsPreferencesTab", () => {
  it("renders Appearance section with theme buttons", () => {
    renderPreferences();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });

  it("renders notation and duration preferences", () => {
    renderPreferences();
    expect(screen.getByRole("button", { name: /sharps/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flats/i })).toBeInTheDocument();
    expect(screen.getByText("Duration display")).toBeInTheDocument();
    expect(screen.getByLabelText("Time zone")).toBeInTheDocument();
  });

  it("persists key notation choice", async () => {
    renderPreferences();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /flats/i }));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ keyNotation: "flats" }));
    });
  });

  it("calls setTheme when theme button clicked", async () => {
    renderPreferences();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls setContrastMode when high contrast button clicked", async () => {
    renderPreferences();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /high contrast mode/i }));
    expect(mockSetContrastMode).toHaveBeenCalledWith("high");
  });

  it("calls setEditorMode when beginner mode is selected", async () => {
    renderPreferences();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /beginner editor mode/i }));
    expect(mockSetEditorMode).toHaveBeenCalledWith("beginner");
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ editorMode: "beginner" }));
    });
  });

  it("applies a theme preset and persists its values", async () => {
    renderPreferences();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /stage dark theme preset/i }));
    expect(mockSetThemePreset).toHaveBeenCalledWith("stage-dark");
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ themePreset: "stage-dark", pageBackground: "#000435" }),
      );
    });
  });

  it("updates custom appearance colors", async () => {
    renderPreferences();
    fireEvent.change(screen.getByLabelText("Primary chord color"), { target: { value: "#123456" } });
    expect(mockSetChordColor).toHaveBeenCalledWith("#123456");
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ themePreset: "custom", chordColor: "#123456" }),
      );
    });
  });
});

describe("AdminOrganizationTab", () => {
  it("renders organization fields for org admins", async () => {
    renderOrganization();
    await waitFor(() => {
      expect(screen.getByLabelText(/name \*/i)).toHaveValue("Test Church");
      expect(screen.getByLabelText("Slug")).toHaveValue("test-church");
    });
  });

  it("saves organization on submit", async () => {
    renderOrganization();
    const user = userEvent.setup();
    const nameInput = screen.getByLabelText(/name \*/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Church");
    await user.click(screen.getByRole("button", { name: /save organization/i }));
    await waitFor(() => {
      expect(mockUpdateOrg).toHaveBeenCalledWith("org1", expect.objectContaining({ name: "Renamed Church" }));
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it("hides the danger zone from non-owners", () => {
    renderOrganization();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
  });

  it("deletes the organization for owners after confirmation", async () => {
    mockAuthValue = {
      ...mockAuthValue,
      user: { ...mockAuthValue.user, role: "owner" },
    };
    renderOrganization();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /delete organization/i }));
    // Confirm dialog opens — click its confirm button (same label as the trigger)
    const deleteButtons = screen.getAllByRole("button", { name: /delete organization/i });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => {
      expect(mockRemoveOrg).toHaveBeenCalledWith("org1");
    });
  });

  it("shows access denied for observers", () => {
    mockAuthValue = {
      ...mockAuthValue,
      activeOrg: { id: "org1", name: "Test Church", role: "observer" },
    };
    renderOrganization();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it("shows error when organization name is empty", async () => {
    const { toast } = await import("sonner");
    renderOrganization();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/name \*/i));
    await user.click(screen.getByRole("button", { name: /save organization/i }));
    expect(toast.error).toHaveBeenCalledWith("Organization name is required");
    expect(mockUpdateOrg).not.toHaveBeenCalled();
  });
});
