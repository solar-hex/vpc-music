import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";

let mockAuth: { isAuthenticated: boolean; isLoading: boolean };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "dark", toggleTheme: vi.fn() }),
}));

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/songs" element={<div>song list</div>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockAuth = { isAuthenticated: false, isLoading: false };
});

describe("LandingPage", () => {
  it("greets a signed-out visitor and points them at sign-in", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every chord chart, on the stand.");
    expect(screen.getByRole("link", { name: "Open VPC Music" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/ask your worship leader for an invite/i)).toBeInTheDocument();
  });

  it("sends a signed-in visitor straight to the song list", () => {
    mockAuth = { isAuthenticated: true, isLoading: false };
    renderLanding();
    expect(screen.getByText("song list")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("waits rather than flashing the landing while the session is checked", () => {
    mockAuth = { isAuthenticated: false, isLoading: true };
    renderLanding();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("song list")).not.toBeInTheDocument();
  });

  it("names what the app does", () => {
    renderLanding();
    for (const point of ["Search that keeps up", "Any key, one tap", "Built for a music stand", "Print or export"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(point, "i") })).toBeInTheDocument();
    }
  });
});
