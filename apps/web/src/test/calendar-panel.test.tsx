import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CalendarPage } from "@/pages/setlists/CalendarPage";

const mockListEvents = vi.fn();
const mockGetEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockListRehearsals = vi.fn();

vi.mock("@/lib/api-client", () => ({
  eventsApi: {
    list: (...args: any[]) => mockListEvents(...args),
    get: (...args: any[]) => mockGetEvent(...args),
    update: (...args: any[]) => mockUpdateEvent(...args),
    delete: (...args: any[]) => mockDeleteEvent(...args),
  },
  rehearsalsApi: {
    list: (...args: any[]) => mockListRehearsals(...args),
  },
  orgsApi: {
    members: () => Promise.resolve({ members: [{ userId: "u2", displayName: "Ana", role: "musician" }] }),
  },
  setlistsApi: {
    list: () => Promise.resolve({ setlists: [{ id: "sl1", name: "Sunday Set" }] }),
  },
}));

let mockAuthValue: any;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/components/dashboard/EventFormDialog", () => ({
  EventFormDialog: ({ open }: any) => (open ? <div data-testid="create-dialog" /> : null),
}));
vi.mock("@/pages/setlists/RehearsalsPage", () => ({
  RehearsalFormDialog: () => null,
}));
vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: ({ open, confirmLabel, onConfirm }: any) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        {confirmLabel}
      </button>
    ) : null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const now = new Date();
const e1Date = new Date(now.getFullYear(), now.getMonth(), 10, 9, 30).toISOString();
const e2Date = new Date(now.getFullYear(), now.getMonth(), 12, 18, 0).toISOString();
const e1 = { id: "e1", title: "Morning worship", date: e1Date, status: "scheduled" };
const e2 = { id: "e2", title: "Evening prayer", date: e2Date, status: "scheduled" };

function panel() {
  return screen.getByTestId("event-edit-panel");
}

function titleInput() {
  return within(panel()).getByLabelText(/Title/) as HTMLInputElement;
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

describe("calendar split-view edit panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEvents.mockResolvedValue({ events: [e1, e2] });
    mockListRehearsals.mockResolvedValue({ rehearsals: [] });
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve({ event: id === "e1" ? { ...e1, location: "Main Hall" } : { ...e2, location: "Chapel" } }),
    );
    mockUpdateEvent.mockImplementation((_id: string, data: any) => Promise.resolve({ event: { ...e1, ...data } }));
    mockDeleteEvent.mockResolvedValue({ message: "ok" });
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "admin" },
    };
  });

  it("clicking an event opens the editable form directly — no details page, no modal", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));

    await waitFor(() => expect(screen.getByTestId("event-edit-panel")).toBeInTheDocument());
    expect(titleInput().value).toBe("Morning worship");
    // Detail fetch fills in the rest of the form
    await waitFor(() => {
      expect((within(panel()).getByLabelText("Location") as HTMLInputElement).value).toBe("Main Hall");
    });
    // Already in edit mode: Save footer present, no separate Edit button
    expect(within(panel()).getByText("Save Changes")).toBeInTheDocument();
    expect(within(panel()).queryByLabelText("Edit event")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-dialog")).not.toBeInTheDocument();
  });

  it("selecting another event replaces the form contents in place", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(titleInput().value).toBe("Morning worship"));

    fireEvent.click(screen.getByText("Evening prayer"));
    await waitFor(() => expect(titleInput().value).toBe("Evening prayer"));
    expect(screen.getAllByTestId("event-edit-panel")).toHaveLength(1);
  });

  it("warns before switching events with unsaved changes, then discards on confirm", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(titleInput().value).toBe("Morning worship"));

    fireEvent.change(titleInput(), { target: { value: "Edited title" } });
    fireEvent.click(screen.getByText("Evening prayer"));

    // Form is NOT replaced yet — the discard confirmation is showing
    expect(titleInput().value).toBe("Edited title");
    fireEvent.click(await screen.findByText("Discard changes"));
    await waitFor(() => expect(titleInput().value).toBe("Evening prayer"));
  });

  it("saves changes from the footer button", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(titleInput().value).toBe("Morning worship"));

    fireEvent.change(titleInput(), { target: { value: "Morning worship v2" } });
    fireEvent.click(within(panel()).getByText("Save Changes"));

    await waitFor(() => expect(mockUpdateEvent).toHaveBeenCalledTimes(1));
    const [id, payload] = mockUpdateEvent.mock.calls[0];
    expect(id).toBe("e1");
    expect(payload.title).toBe("Morning worship v2");
  });

  it("Ctrl+S saves changes", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(titleInput().value).toBe("Morning worship"));

    fireEvent.change(titleInput(), { target: { value: "Shortcut save" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    await waitFor(() => expect(mockUpdateEvent).toHaveBeenCalledTimes(1));
    expect(mockUpdateEvent.mock.calls[0][1].title).toBe("Shortcut save");
  });

  it("Esc closes a clean panel but asks first when dirty", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(screen.getByTestId("event-edit-panel")).toBeInTheDocument());

    fireEvent.change(titleInput(), { target: { value: "Dirty" } });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("event-edit-panel")).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Discard changes"));
    await waitFor(() => expect(screen.queryByTestId("event-edit-panel")).not.toBeInTheDocument());
  });

  it("deletes the event after confirmation and closes the panel", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(within(panel()).getByText("Delete Event")).toBeInTheDocument());

    fireEvent.click(within(panel()).getByText("Delete Event"));
    fireEvent.click(await screen.findByText("Delete event"));
    await waitFor(() => expect(mockDeleteEvent).toHaveBeenCalledWith("e1"));
    await waitFor(() => expect(screen.queryByTestId("event-edit-panel")).not.toBeInTheDocument());
  });

  it("read-only roles get disabled fields and no action footer", async () => {
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "observer" },
    };
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(screen.getByTestId("event-edit-panel")).toBeInTheDocument());

    expect(titleInput()).toBeDisabled();
    expect(within(panel()).queryByText("Save Changes")).not.toBeInTheDocument();
    expect(within(panel()).queryByText("Delete Event")).not.toBeInTheDocument();
  });
});
