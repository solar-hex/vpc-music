import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { PreferencesSync } from "@/components/shared/PreferencesSync";

const mockGetSettings = vi.fn();
vi.mock("@/lib/api-client", () => ({
  platformApi: { getSettings: () => mockGetSettings() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const setters = {
  setTheme: vi.fn(),
  setChordColor: vi.fn(),
  setSecondaryChordColor: vi.fn(),
  setKeyNotation: vi.fn(),
  setPageWidth: vi.fn(),
};
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => setters,
}));

describe("PreferencesSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the account's appearance, page width included, once signed in", async () => {
    mockGetSettings.mockResolvedValue({
      settings: { theme: "light", chordColor: "#112233", keyNotation: "sharps", pageWidth: "full" },
    });
    render(<PreferencesSync />);
    await waitFor(() => expect(setters.setPageWidth).toHaveBeenCalledWith("full"));
    expect(setters.setTheme).toHaveBeenCalledWith("light");
    expect(setters.setChordColor).toHaveBeenCalledWith("#112233");
    expect(setters.setKeyNotation).toHaveBeenCalledWith("sharps");
  });

  it("leaves the device's width alone when the account has none, or an unknown one", async () => {
    mockGetSettings.mockResolvedValue({ settings: { theme: "dark", pageWidth: "wide" } });
    render(<PreferencesSync />);
    await waitFor(() => expect(setters.setTheme).toHaveBeenCalledWith("dark"));
    expect(setters.setPageWidth).not.toHaveBeenCalled();
  });
});
