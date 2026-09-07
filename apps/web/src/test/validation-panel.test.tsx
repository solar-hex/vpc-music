import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValidationPanel } from "@/components/songs/ValidationPanel";

describe("ValidationPanel", () => {
  // ── Not visible when no issues ──

  it("renders nothing for valid content", () => {
    const { container } = render(<ValidationPanel source="{title: Test}" />);
    expect(screen.queryByTestId("validation-panel")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  it("renders nothing for empty content", () => {
    render(<ValidationPanel source="" />);
    expect(screen.queryByTestId("validation-panel")).not.toBeInTheDocument();
  });

  // ── Shows when there are issues ──

  it("shows panel for content with errors", () => {
    render(<ValidationPanel source="[G open bracket" />);
    expect(screen.getByTestId("validation-panel")).toBeInTheDocument();
  });

  it("shows panel for content with warnings", () => {
    render(<ValidationPanel source="{unknown_dir: value}" />);
    expect(screen.getByTestId("validation-panel")).toBeInTheDocument();
  });

  // ── Issue counts ──

  it("shows error count", () => {
    render(<ValidationPanel source="[G open bracket\n{open brace" />);
    const panel = screen.getByTestId("validation-panel");
    // Should show at least 2 errors
    expect(panel).toHaveTextContent(/2 issues/);
  });

  it("shows issue rows when expanded", () => {
    render(<ValidationPanel source="[G open bracket" />);
    // Expanded by default
    expect(screen.getByTestId("validation-issues")).toBeInTheDocument();
    const rows = screen.getAllByTestId("validation-issue");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("shows line numbers in issue rows", () => {
    render(<ValidationPanel source="[G open bracket" />);
    const rows = screen.getAllByTestId("validation-issue");
    expect(rows[0]).toHaveTextContent(/Line \d+/);
  });

  // ── Collapsible toggle ──

  it("collapses issues on toggle click", async () => {
    const user = userEvent.setup();
    render(<ValidationPanel source="[G open bracket" />);
    expect(screen.getByTestId("validation-issues")).toBeInTheDocument();

    await user.click(screen.getByTestId("validation-toggle"));
    expect(screen.queryByTestId("validation-issues")).not.toBeInTheDocument();
  });

  it("re-expands on second toggle click", async () => {
    const user = userEvent.setup();
    render(<ValidationPanel source="[G open bracket" />);

    await user.click(screen.getByTestId("validation-toggle"));
    expect(screen.queryByTestId("validation-issues")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("validation-toggle"));
    expect(screen.getByTestId("validation-issues")).toBeInTheDocument();
  });

  // ── Mixed errors and warnings ──

  it("shows both error and warning counts for mixed content", () => {
    // Unclosed bracket = error, unknown directive = warning
    const source = "[G open\n{unknown_dir: test}";
    render(<ValidationPanel source={source} />);
    expect(screen.getByTestId("validation-panel")).toHaveTextContent("2 issues");
  });

  // ── Duplicate directives ──

  it("shows warning for duplicate title directives", () => {
    render(<ValidationPanel source={"{title: One}\n{title: Two}"} />);
    expect(screen.getByTestId("validation-panel")).toBeInTheDocument();
    const rows = screen.getAllByTestId("validation-issue");
    expect(rows.some((r) => r.textContent?.includes("Duplicate"))).toBe(true);
  });

  it("renders inline fix buttons when apply handlers are provided", async () => {
    const user = userEvent.setup();
    const onApplyFix = vi.fn();
    render(<ValidationPanel source="[g / b]Amazing grace" onApplyFix={onApplyFix} />);
    const fixButton = screen.getByTestId("validation-fix-btn");
    expect(fixButton).toHaveTextContent("Use [G/B]");
    await user.click(fixButton);
    expect(onApplyFix).toHaveBeenCalledTimes(1);
  });
});
