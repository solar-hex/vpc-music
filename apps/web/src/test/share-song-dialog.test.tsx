import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ShareSongDialog } from "@/components/songs/ShareSongDialog";

const mockCreate = vi.fn();
const mockStop = vi.fn();
vi.mock("@/lib/api-client", () => ({
  shareApi: {
    create: (...args: any[]) => mockCreate(...args),
    stopSharing: (...args: any[]) => mockStop(...args),
  },
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (...a: any[]) => toast.success(...a), error: (...a: any[]) => toast.error(...a) } }));

function renderDialog(path = "/songs/song-1", onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShareSongDialog open onClose={onClose} songId="song-1" songTitle="Covered" />
    </MemoryRouter>,
  );
  return { onClose };
}

const linkField = () => screen.findByLabelText("Share link");

describe("ShareSongDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ shareToken: {}, shareUrl: "/shared/tok123" });
    mockStop.mockResolvedValue({ revoked: 1 });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("says plainly what the link gives, before anything else", async () => {
    renderDialog();
    expect(screen.getByText(/can view this chart, change its key, play its parts and print it/i)).toBeInTheDocument();
    expect(screen.getByText(/can't edit it or see any other song/i)).toBeInTheDocument();
    await linkField();
  });

  it("shows the song's link and copies it", async () => {
    // user-event installs its own clipboard, so read back what landed there.
    const user = userEvent.setup();
    renderDialog();
    expect(mockCreate).toHaveBeenCalledWith("song-1");
    expect(await linkField()).toHaveValue(`${window.location.origin}/shared/tok123`);
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/shared/tok123`);
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });

  it("sends the link in the key on screen, and says so", async () => {
    renderDialog("/songs/song-1?key=A");
    expect(await linkField()).toHaveValue(`${window.location.origin}/shared/tok123?key=A`);
    expect(screen.getByText("Opens in the key of A.")).toBeInTheDocument();
  });

  it("offers the phone's own share sheet only where there is one", async () => {
    renderDialog();
    await linkField();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("hands the link to the share sheet on a device that has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const user = userEvent.setup();
    renderDialog();
    await linkField();
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Covered", url: `${window.location.origin}/shared/tok123` }));
  });

  it("asks before turning the link off, and lets you keep sharing", async () => {
    const user = userEvent.setup();
    renderDialog();
    await linkField();
    await user.click(screen.getByRole("button", { name: /stop sharing/i }));
    expect(screen.getByText(/anyone who has it loses access/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep sharing" }));
    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /stop sharing/i })).toBeInTheDocument();
  });

  it("turns the link off for everyone and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await linkField();
    await user.click(screen.getByRole("button", { name: /stop sharing/i }));
    await user.click(screen.getByRole("button", { name: "Turn off link" }));
    await waitFor(() => expect(mockStop).toHaveBeenCalledWith("song-1"));
    expect(toast.success).toHaveBeenCalledWith("Link turned off");
    expect(onClose).toHaveBeenCalled();
  });

  it("says when a link could not be made, and tries again", async () => {
    mockCreate.mockRejectedValueOnce(new Error("HTTP 500"));
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not get a link/i);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await linkField()).toHaveValue(`${window.location.origin}/shared/tok123`);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
