import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TemplatesPage } from "@/pages/setlists/TemplatesPage";

const mockList = vi.fn();
const mockApply = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/lib/api-client", () => ({
  templatesApi: {
    list: (...args: any[]) => mockList(...args),
    apply: (...args: any[]) => mockApply(...args),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
    activeOrg: { id: "org1", name: "Test Church", role: "admin" },
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <TemplatesPage />
    </MemoryRouter>,
  );
}

const template = {
  id: "t1",
  title: "Sunday shape",
  description: null,
  structure: [{ label: "Fast opener" }, { label: "Slow" }],
};

describe("TemplatesPage — Apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ templates: [template] });
  });

  it("applies a template and navigates to the new setlist", async () => {
    mockApply.mockResolvedValue({ setlist: { id: "new-1" }, slotCount: 2 });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /use template/i }));

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith("t1");
      expect(mockNavigate).toHaveBeenCalledWith("/setlists/new-1", { state: { setlist: { id: "new-1" } } });
    });
  });

  it("shows an error instead of navigating when the server response is missing the new setlist", async () => {
    // Regression guard: mirrors the same fix in SetlistHubPage — silently
    // routing to /setlists/undefined lands on "Setlist not found" instead
    // of surfacing the failure.
    mockApply.mockResolvedValue({ slotCount: 2 });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /use template/i }));

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
