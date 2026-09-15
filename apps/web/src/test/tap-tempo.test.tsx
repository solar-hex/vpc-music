import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import { addTap, tempoFromTaps, RESTART_MS } from "@/lib/tap-tempo";
import { TapTempoPad } from "@/components/songs/TapTempoPad";

/** Taps at a steady beat: `count` taps, `gap` ms apart, from `start`. */
const beat = (count: number, gap: number, start = 1000) => Array.from({ length: count }, (_, i) => start + i * gap);
const tapAll = (times: number[], taps: number[] = []) => times.reduce((kept, time) => addTap(kept, time), taps);

describe("tempoFromTaps", () => {
  it("needs a second tap before it says anything", () => {
    expect(tempoFromTaps(tapAll([1000]))).toBeNull();
    expect(tempoFromTaps(tapAll(beat(2, 500)))).toBe(120);
  });

  it("averages the last eight taps, so it settles and one late tap barely moves it", () => {
    const steady = tapAll(beat(8, 500));
    expect(steady).toHaveLength(8);
    expect(tempoFromTaps(steady)).toBe(120);
    const oneLate = addTap(steady, steady[7] + 560);
    expect(oneLate).toHaveLength(8);
    expect(tempoFromTaps(oneLate)).toBe(118);
  });

  it("forgets taps older than the last eight", () => {
    // Twelve slow taps, then eight fast ones: only the fast ones count.
    const slow = beat(12, 1000);
    const fast = beat(8, 400, slow[11] + 400);
    expect(tempoFromTaps(tapAll([...slow, ...fast]))).toBe(150);
  });

  it("starts over after a pause", () => {
    const first = tapAll(beat(5, 600));
    const again = addTap(first, first[4] + RESTART_MS + 1);
    expect(again).toHaveLength(1);
    expect(tempoFromTaps(again)).toBeNull();
  });

  it("keeps the tempo within what the song field takes", () => {
    expect(tempoFromTaps([0, 100])).toBe(300);
    expect(tempoFromTaps([0, 2999])).toBe(20);
  });
});

describe("TapTempoPad", () => {
  const press = (time: number) => {
    const button = screen.getByRole("button", { name: "Tap tempo" });
    const event = createEvent.pointerDown(button);
    Object.defineProperty(event, "timeStamp", { value: time });
    fireEvent(button, event);
  };

  it("fills the tempo from the second tap on, and says so", () => {
    const onTempo = vi.fn();
    render(<TapTempoPad onTempo={onTempo} />);
    expect(screen.getByText("Tap the beat")).toBeInTheDocument();
    press(1000);
    expect(onTempo).not.toHaveBeenCalled();
    expect(screen.getByText("Keep tapping")).toBeInTheDocument();
    press(1750);
    expect(onTempo).toHaveBeenLastCalledWith(80);
    press(2500);
    expect(screen.getByText("80 BPM · 3 taps")).toBeInTheDocument();
  });

  it("counts a keyboard or screen reader press once, and a pointer's click not twice", () => {
    const onTempo = vi.fn();
    render(<TapTempoPad onTempo={onTempo} />);
    const button = screen.getByRole("button", { name: "Tap tempo" });
    press(1000);
    const click = (detail: number, time: number) => {
      const event = createEvent.click(button, { detail });
      Object.defineProperty(event, "timeStamp", { value: time });
      fireEvent(button, event);
    };
    click(1, 1010); // the click that follows a pointer press
    expect(screen.getByText("Keep tapping")).toBeInTheDocument();
    click(0, 1500); // Enter, Space or assistive technology
    expect(onTempo).toHaveBeenCalledTimes(1);
    expect(onTempo).toHaveBeenCalledWith(120);
  });
});
