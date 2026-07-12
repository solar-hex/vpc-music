import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowStrip } from "@/components/setlists/FlowStrip";
import type { SetlistSongItem } from "@/lib/api-client";

function item(overrides: Partial<SetlistSongItem>): SetlistSongItem {
  return {
    id: overrides.id ?? "item",
    songId: "song",
    position: 0,
    songTitle: "Song",
    songTempo: 100,
    ...overrides,
  };
}

describe("FlowStrip", () => {
  it("grades a parallel major/minor move (C -> Cm) as smooth, not notable", () => {
    // Regression test: the ribbon previously graded key transitions with the
    // raw circle-of-fifths distance (no parallel/relative special case), so a
    // C -> Cm move — a very common, genuinely smooth modulation — rendered as
    // an amber "notable" connector instead of green "smooth".
    const items = [
      item({ id: "a", songKey: "C", songTitle: "Verse in C" }),
      item({ id: "b", songKey: "Cm", songTitle: "Bridge in Cm" }),
    ];
    render(<FlowStrip items={items} />);

    const connector = screen.getByTestId("flow-connector-1");
    expect(connector.className).toContain("bg-emerald-500"); // smooth
    expect(connector.className).not.toContain("bg-amber-500"); // notable
  });

  it("still grades a harsh jump (C -> F#) as harsh", () => {
    const items = [
      item({ id: "a", songKey: "C", songTitle: "Song A" }),
      item({ id: "b", songKey: "F#", songTitle: "Song B" }),
    ];
    render(<FlowStrip items={items} />);

    expect(screen.getByTestId("flow-connector-1").className).toContain("bg-red-500");
  });

  it("renders nothing for fewer than two songs", () => {
    const { container } = render(<FlowStrip items={[item({ id: "solo" })]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
