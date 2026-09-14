import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SongAudioBar } from "@/components/songs/SongAudioBar";
import type { SongAudioTrack } from "@/lib/song-media";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  songsApi: { mediaHref: (id: string, key: string) => `/api/songs/${id}/media/${key}` },
}));

const track = (directive: string, label: string, part: SongAudioTrack["part"] = "soprano"): SongAudioTrack => ({
  directive,
  part,
  label,
  bpm: null,
  alternate: false,
});

const TRACKS = [
  track("x_audio_soprano", "Soprano", "soprano"),
  track("x_audio_alto", "Alto", "alto"),
  track("x_audio_tenor", "Tenor", "tenor"),
];

/*
 * jsdom does not implement media playback: HTMLMediaElement.play is a
 * "not implemented" stub that returns undefined rather than a promise. So the
 * prototype is stubbed, and every state change is driven by firing the real
 * media events at the real <audio> element, the way a browser would.
 */
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
const load = vi.fn();

beforeEach(() => {
  play.mockReset().mockImplementation(() => Promise.resolve());
  pause.mockReset();
  load.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(load);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const audio = () => document.querySelector("audio") as HTMLAudioElement;
const chip = (name: RegExp | string) => screen.getByRole("button", { name });
const fire = (type: string) => act(() => void fireEvent(audio(), new Event(type)));

function renderBar(tracks = TRACKS) {
  return render(<SongAudioBar songId="song-1" tracks={tracks} />);
}

describe("SongAudioBar", () => {
  it("renders nothing for a song with no audio", () => {
    const { container } = renderBar([]);
    expect(container.firstChild).toBeNull();
  });

  it("offers one button per part, in the order given", () => {
    renderBar();
    const labels = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["Play Soprano", "Play Alto", "Play Tenor"]);
  });

  it("fetches nothing until a part is tapped, and never reaches a printed sheet", () => {
    renderBar();
    expect(audio().getAttribute("preload")).toBe("none");
    expect(audio().getAttribute("src")).toBeNull();
    expect(screen.getByTestId("song-audio-bar")).toHaveClass("print-hidden");
  });

  it("plays a tapped part through the signed media route", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    expect(audio().getAttribute("src")).toBe("/api/songs/song-1/media/x_audio_alto");
    expect(play).toHaveBeenCalledTimes(1);
    expect(chip("Play Alto")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the part as playing once audio actually starts", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    expect(chip("Pause Alto")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Playing Alto")).toBeInTheDocument();
  });

  it("pauses when the playing part is tapped again, and resumes without reloading", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    fireEvent.click(chip("Pause Alto"));
    expect(pause).toHaveBeenCalled();
    expect(chip("Play Alto")).toHaveAttribute("aria-pressed", "false");

    const srcBefore = audio().getAttribute("src");
    fireEvent.click(chip("Play Alto"));
    expect(audio().getAttribute("src")).toBe(srcBefore);
  });

  it("swaps to a second part, and only that part is pressed", () => {
    renderBar();
    fireEvent.click(chip("Play Soprano"));
    fire("playing");
    fireEvent.click(chip("Play Tenor"));
    fire("playing");
    expect(audio().getAttribute("src")).toBe("/api/songs/song-1/media/x_audio_tenor");
    const pressed = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => b.getAttribute("aria-label"))).toEqual(["Pause Tenor"]);
  });

  it("does not let the old part's pause event mark the new part as paused", () => {
    // Media events are queued. Swapping calls pause() on the old source, and
    // that pause event arrives after the new part is already loading. It must
    // not flip the new part to "paused".
    renderBar();
    fireEvent.click(chip("Play Soprano"));
    fire("playing");
    fireEvent.click(chip("Play Tenor")); // tenor is now loading
    fire("pause"); // the queued pause from soprano arrives late
    expect(chip("Play Tenor")).toHaveAttribute("aria-busy", "true");
    fire("playing");
    expect(chip("Pause Tenor")).toHaveAttribute("aria-pressed", "true");
  });

  it("honours a pause that comes from outside, like the lock screen or a phone call", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    fire("pause");
    expect(chip("Play Alto")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Alto paused")).toBeInTheDocument();
  });

  it("shows elapsed time while playing", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    Object.defineProperty(audio(), "currentTime", { value: 72, configurable: true });
    fire("timeupdate");
    expect(screen.getByText("1:12")).toBeInTheDocument();
  });

  it("replays the current part from the start", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    Object.defineProperty(audio(), "currentTime", { value: 40, configurable: true, writable: true });
    fireEvent.click(screen.getByRole("button", { name: "Replay Alto from the start" }));
    expect(audio().currentTime).toBe(0);
  });

  it("marks a part unavailable when it will not load, and keeps the others working", async () => {
    const { toast } = await import("sonner");
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("error");
    const broken = screen.getByRole("button", { name: /Alto unavailable/ });
    expect(broken).toBeDisabled();
    expect(toast.error).toHaveBeenCalledWith("That recording could not be loaded");

    fireEvent.click(chip("Play Tenor"));
    expect(audio().getAttribute("src")).toBe("/api/songs/song-1/media/x_audio_tenor");
  });

  it("treats a refused play() the same as a failed load", async () => {
    play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    renderBar();
    await act(async () => {
      fireEvent.click(chip("Play Soprano"));
    });
    expect(screen.getByRole("button", { name: /Soprano unavailable/ })).toBeDisabled();
  });

  it("returns to idle when a part finishes", () => {
    renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    fire("ended");
    expect(chip("Play Alto")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /Replay/ })).not.toBeInTheDocument();
  });

  it("does not start playback on Space, which is the foot pedal's page turn", () => {
    renderBar();
    fireEvent.keyDown(document, { key: " " });
    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    expect(play).not.toHaveBeenCalled();
  });

  it("stops playback when the chart is closed", () => {
    const { unmount } = renderBar();
    fireEvent.click(chip("Play Alto"));
    fire("playing");
    pause.mockClear();
    unmount();
    expect(pause).toHaveBeenCalled();
  });
});
