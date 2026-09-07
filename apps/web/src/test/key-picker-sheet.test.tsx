import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyPickerSheet } from "@/components/songs/KeyPickerSheet";

describe("KeyPickerSheet", () => {
  it("renders the 12 keys with flats by default and marks the current key", () => {
    render(<KeyPickerSheet open onClose={() => {}} currentKey="Bb" originalKey="G" onPick={() => {}} />);
    const buttons = screen.getAllByRole("button", { pressed: false }).concat(screen.getAllByRole("button", { pressed: true }));
    const labels = buttons.map((button) => button.textContent?.replace(/\(original key\)/, "").trim());
    expect(labels).toEqual(expect.arrayContaining(["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]));
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("Bb");
    expect(screen.getByText("Original key: G")).toBeInTheDocument();
  });

  it("uses sharps when asked and treats enharmonic keys as the same", () => {
    render(<KeyPickerSheet open onClose={() => {}} currentKey="Db" originalKey="C" notation="sharps" onPick={() => {}} />);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("C#");
  });

  it("labels keys as minor for a minor song", () => {
    render(<KeyPickerSheet open onClose={() => {}} currentKey="Em" originalKey="Em" onPick={() => {}} />);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("Em");
    expect(screen.getByRole("button", { name: /^Am$/ })).toBeInTheDocument();
  });

  it("reports the picked key and closes", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<KeyPickerSheet open onClose={onClose} currentKey="G" originalKey="G" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /^D$/ }));
    expect(onPick).toHaveBeenCalledWith("D");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(<KeyPickerSheet open={false} onClose={() => {}} currentKey="G" originalKey="G" onPick={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
