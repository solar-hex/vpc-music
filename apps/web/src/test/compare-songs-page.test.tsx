import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { CompareSongsPage } from "@/pages/songs/CompareSongsPage";

const api = {
  get: vi.fn(),
  merge: vi.fn(),
  unmerge: vi.fn(),
  update: vi.fn(),
  markDistinct: vi.fn(),
};
vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: unknown[]) => api.get(...args),
    merge: (...args: unknown[]) => api.merge(...args),
    unmerge: (...args: unknown[]) => api.unmerge(...args),
    update: (...args: unknown[]) => api.update(...args),
    markDistinct: (...args: unknown[]) => api.markDistinct(...args),
  },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const invalidate = vi.fn();
vi.mock("@/hooks/useSongLibrary", () => ({ invalidateSongLibrary: () => invalidate() }));

let mockRole = "musician";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "member" }, activeOrg: { role: mockRole } }),
}));

const CHART = {
  id: "chart",
  title: "Press On",
  key: "G",
  artist: null,
  content: "{title: Press On}\n{key: G}\n{x_source: chrd:press_on.chrd}\n\n[G]We press on",
  isDraft: false,
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const SHEET = {
  id: "sheet",
  title: "We press on",
  artist: "Kevin Duncan",
  content: "{title: We press on}\n{artist: Kevin Duncan}\n{x_source: docx:We press on.docx}\n\nWe press on",
  isDraft: false,
  updatedAt: "2026-09-02T00:00:00.000Z",
};

function renderCompare(path = "/library/duplicates/chart/sheet") {
  const router = createMemoryRouter(
    [
      { path: "/library/duplicates/:leftId/:rightId", element: <CompareSongsPage /> },
      { path: "/library/duplicates", element: <div>Duplicate list</div> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const pane = (name: RegExp) => screen.getByRole("region", { name });
const chartText = (title: string) => screen.getByRole("textbox", { name: `Chart text for ${title}` }) as HTMLTextAreaElement;

describe("CompareSongsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "musician";
    api.get.mockImplementation(async (id: string) => ({ song: id === "chart" ? CHART : SHEET, variations: [] }));
    api.merge.mockResolvedValue({ song: { ...CHART }, merged: { id: "sheet", title: "We press on" } });
    api.unmerge.mockResolvedValue({ song: SHEET });
    api.update.mockResolvedValue({ song: CHART });
    api.markDistinct.mockResolvedValue({ ok: true, distinct: true });
  });

  it("shows both charts side by side, keeping the left one unless told otherwise", async () => {
    renderCompare();
    expect(await screen.findByRole("region", { name: /Left copy: Press On/ })).toBeInTheDocument();
    expect(within(pane(/Right copy/)).getByText(/Kevin Duncan · Listed · Word lyric sheet/)).toBeInTheDocument();
    expect(chartText("Press On").value).toBe(CHART.content);
    expect(within(pane(/Left copy/)).getByRole("radio", { name: "Keep this one" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Merge, keep “Press On”" })).toBeInTheDocument();
  });

  it("copies a selection from one chart into the other at its cursor", async () => {
    renderCompare();
    const right = await screen.findByRole("textbox", { name: "Chart text for We press on" }) as HTMLTextAreaElement;
    const left = chartText("Press On");
    right.setSelectionRange(right.value.indexOf("\n"), right.value.indexOf("\n"));
    const start = left.value.indexOf("{key: G}");
    left.setSelectionRange(start, start + "{key: G}".length);

    fireEvent.click(screen.getByRole("button", { name: "Copy to right →" }));
    expect(chartText("We press on").value).toBe(SHEET.content.replace("{title: We press on}", "{title: We press on}{key: G}"));
    expect(within(pane(/Right copy/)).getByRole("button", { name: "Undo my changes" })).toBeInTheDocument();
  });

  it("copies the cursor's line across when nothing is selected", async () => {
    renderCompare();
    const right = await screen.findByRole("textbox", { name: "Chart text for We press on" }) as HTMLTextAreaElement;
    right.setSelectionRange(right.value.indexOf("{artist"), right.value.indexOf("{artist"));
    const left = chartText("Press On");
    left.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "← Copy to left" }));
    expect(chartText("Press On").value).toBe(CHART.content.replace("{title: Press On}", "{title: Press On}\n{artist: Kevin Duncan}"));
  });

  it("merges into the copy chosen, with its edited chart, and offers an undo", async () => {
    const router = renderCompare();
    await screen.findByRole("region", { name: /Right copy/ });
    fireEvent.click(within(pane(/Right copy/)).getByRole("radio", { name: "Keep this one" }));
    const edited = `${SHEET.content}\n[G]Till we see Him face to face`;
    fireEvent.change(chartText("We press on"), { target: { value: edited } });

    fireEvent.click(screen.getByRole("button", { name: "Merge, keep “We press on”" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("“We press on” keeps the chart on the right, with your changes.");
    expect(dialog).toHaveTextContent("“Press On” is archived and can be brought back.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Merge" }));

    await waitFor(() =>
      expect(api.merge).toHaveBeenCalledWith("sheet", {
        otherId: "chart",
        content: edited,
        keptUpdatedAt: SHEET.updatedAt,
        otherUpdatedAt: CHART.updatedAt,
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/library/duplicates"));
    expect(invalidate).toHaveBeenCalled();

    const [, options] = toast.success.mock.calls[0];
    options.action.onClick();
    await waitFor(() => expect(api.unmerge).toHaveBeenCalledWith("chart"));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("sheet", expect.objectContaining({ content: SHEET.content, title: "We press on", forceOverwrite: true })));
    await waitFor(() => expect(router.state.location.pathname).toBe("/library/duplicates/chart/sheet"));
  });

  it("warns that changes to the copy being archived are not kept", async () => {
    renderCompare();
    await screen.findByRole("region", { name: /Right copy/ });
    fireEvent.change(chartText("We press on"), { target: { value: "changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Merge, keep “Press On”" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Changes you made to “We press on” here are not kept.");
  });

  it("stays put and says why when the merge is refused", async () => {
    api.merge.mockRejectedValueOnce(new Error("One of these songs was changed since you opened it. Reload to see the latest."));
    const router = renderCompare();
    await screen.findByRole("region", { name: /Left copy/ });
    fireEvent.click(screen.getByRole("button", { name: "Merge, keep “Press On”" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("One of these songs was changed since you opened it. Reload to see the latest."));
    expect(router.state.location.pathname).toBe("/library/duplicates/chart/sheet");
  });

  it("marks the pair as different songs straight away when nothing was edited", async () => {
    const router = renderCompare();
    await screen.findByRole("region", { name: /Left copy/ });
    fireEvent.click(screen.getByRole("button", { name: "Not duplicates" }));
    await waitFor(() => expect(api.markDistinct).toHaveBeenCalledWith("chart", "sheet"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/library/duplicates"));
    const [, options] = toast.success.mock.calls[0];
    options.action.onClick();
    await waitFor(() => expect(api.markDistinct).toHaveBeenCalledWith("chart", "sheet", false));
  });

  it("asks before leaving with edits that would be lost", async () => {
    const router = renderCompare();
    await screen.findByRole("region", { name: /Left copy/ });
    fireEvent.change(chartText("Press On"), { target: { value: "edited" } });
    fireEvent.click(screen.getByRole("link", { name: /Possible duplicates/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Leave without merging?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/library/duplicates"));
  });

  it("explains when one of the songs was already merged", async () => {
    api.get.mockImplementation(async (id: string) => ({ song: id === "chart" ? CHART : { ...SHEET, isArchived: true }, variations: [] }));
    renderCompare();
    expect(await screen.findByText("One of these songs has already been merged or archived.")).toBeInTheDocument();
  });
});
