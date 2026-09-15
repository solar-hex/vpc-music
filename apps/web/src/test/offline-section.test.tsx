import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OfflineSection } from "@/pages/settings/OfflineSection";

const setEnabled = vi.fn();
const refresh = vi.fn();
let mockStatus: Record<string, unknown>;
vi.mock("@/hooks/useOfflineLibrary", () => ({
  useOfflineLibrary: () => ({ ...mockStatus, setEnabled, refresh }),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const off = { supported: true, enabled: false, syncing: false, count: 0, syncedAt: null, error: null };

describe("OfflineSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus = { ...off };
  });

  it("explains what it keeps and what it never stores, and starts off", () => {
    render(<OfflineSection />);
    expect(screen.getByText(/Keep a copy of every chord chart on this device/)).toBeInTheDocument();
    expect(screen.getByText(/Practice audio and chart PDFs are never stored/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Keep every chart on this device" })).not.toBeChecked();
    expect(screen.getByText(/Only charts opened recently/)).toBeInTheDocument();
  });

  it("turns on and says how many charts it saved", async () => {
    setEnabled.mockResolvedValue({ ...off, enabled: true, count: 842, syncedAt: new Date().toISOString() });
    render(<OfflineSection />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("842 charts saved on this device"));
  });

  it("says what went wrong when the charts could not be saved", async () => {
    setEnabled.mockResolvedValue({ ...off, enabled: true, error: "Failed to fetch" });
    render(<OfflineSection />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save the charts: Failed to fetch"));
  });

  it("shows what is saved and when, with a refresh, and what turning it off does", () => {
    mockStatus = { ...off, enabled: true, count: 842, syncedAt: new Date(Date.now() - 10 * 60000).toISOString() };
    render(<OfflineSection />);
    expect(screen.getByText("842 charts saved, updated 10 minutes ago")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText(/Turning this off deletes the saved charts/)).toBeInTheDocument();
  });

  it("turns off and removes the charts", async () => {
    mockStatus = { ...off, enabled: true, count: 842, syncedAt: new Date().toISOString() };
    setEnabled.mockResolvedValue({ ...off });
    render(<OfflineSection />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Offline charts removed from this device"));
  });

  it("shows a failed update without hiding the saved copy", () => {
    mockStatus = { ...off, enabled: true, count: 842, syncedAt: new Date().toISOString(), error: "Failed to fetch" };
    render(<OfflineSection />);
    expect(screen.getByRole("alert")).toHaveTextContent("The last update did not finish: Failed to fetch");
    expect(screen.getByText(/842 charts saved/)).toBeInTheDocument();
  });

  it("says so on a browser that cannot keep charts", () => {
    mockStatus = { ...off, supported: false };
    render(<OfflineSection />);
    expect(screen.getByText("This browser cannot keep charts for offline use.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
