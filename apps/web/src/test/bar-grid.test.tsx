import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ChordProRenderer } from "@/components/songs/ChordProRenderer";

// Uses the REAL @vpc-music/shared engine (no mocks) — this is an integration
// test of bar-row parsing, grid grouping, and target-key transposition.

const CHART = [
  "{title: Instrumental}",
  "[Intro]",
  "| G | C/E | D |",
  "|Em|C|",
  "",
  "[Verse 1]",
  "[G]Amazing [C]grace",
].join("\n");

describe("bar grid rendering", () => {
  it("groups consecutive bar rows into one aligned grid", () => {
    render(<ChordProRenderer content={CHART} songKey="G" />);
    const grids = screen.getAllByTestId("bar-grid");
    expect(grids).toHaveLength(1);
    const grid = grids[0];
    expect(within(grid).getByText("C/E")).toBeInTheDocument();
    // Unpadded pipes still tokenize
    expect(within(grid).getByText("Em")).toBeInTheDocument();
    // Lyric lines stay outside the grid
    expect(within(grid).queryByText(/Amazing/)).not.toBeInTheDocument();
  });

  it("transposes bar cells with target-key spelling", () => {
    render(<ChordProRenderer content={CHART} songKey="G" />);
    const plus = screen.getByText("+");
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus); // +3: G → Bb, a flat key
    const grid = screen.getByTestId("bar-grid");
    expect(within(grid).getByText("Bb")).toBeInTheDocument(); // G → Bb
    expect(within(grid).getByText("Eb/G")).toBeInTheDocument(); // C/E → Eb/G
    expect(within(grid).getByText("Gm")).toBeInTheDocument(); // Em → Gm
  });

  it("hides bar rows entirely in lyrics-only view", () => {
    render(<ChordProRenderer content={CHART} showChords={false} />);
    expect(screen.queryByTestId("bar-grid")).not.toBeInTheDocument();
    expect(screen.getByText(/Amazing/)).toBeInTheDocument();
  });
});
