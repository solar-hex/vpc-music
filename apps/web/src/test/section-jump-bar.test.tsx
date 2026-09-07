import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionJumpBar, jumpToSection } from "@/components/songs/SectionJumpBar";

describe("SectionJumpBar", () => {
  it("renders Top plus one button per section and reports taps", () => {
    const onJump = vi.fn();
    render(
      <SectionJumpBar
        sections={[
          { id: "section-0", label: "Verse 1" },
          { id: "section-2", label: "Chorus" },
        ]}
        onJump={onJump}
      />,
    );
    expect(screen.getByRole("navigation", { name: /song sections/i })).toHaveClass("print-hidden");
    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    expect(onJump).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Chorus" }));
    expect(onJump).toHaveBeenCalledWith("section-2");
  });

  it("jumpToSection scrolls the container to the top for Top", () => {
    const container = document.createElement("div");
    container.scrollTo = vi.fn();
    jumpToSection(container, null);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("jumpToSection scrolls the section into view and flashes it", () => {
    const target = document.createElement("div");
    target.id = "section-1";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    jumpToSection(null, "section-1");
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(target.classList.contains("section-flash")).toBe(true);
    target.dispatchEvent(new Event("animationend"));
    expect(target.classList.contains("section-flash")).toBe(false);
    target.remove();
  });

  it("jumpToSection ignores unknown ids", () => {
    expect(() => jumpToSection(null, "missing")).not.toThrow();
  });
});
