import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CalendarPage } from "@/pages/setlists/CalendarPage";

const mockListEvents = vi.fn();
const mockGetEvent = vi.fn();
const mockCreateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockListRehearsals = vi.fn();

vi.mock("@/lib/api-client", () => ({
  eventsApi: {
    list: (...args: any[]) => mockListEvents(...args),
    get: (...args: any[]) => mockGetEvent(...args),
    create: (...args: any[]) => mockCreateEvent(...args),
    delete: (...args: any[]) => mockDeleteEvent(...args),
    update: (...args: any[]) => mockUpdateEvent(...args),
  },
  rehearsalsApi: {
    list: (...args: any[]) => mockListRehearsals(...args),
  },
}));

let mockAuthValue: any;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/components/dashboard/EventFormDialog", () => ({
  EventFormDialog: ({ open }: any) => (open ? <div data-testid="edit-dialog" /> : null),
}));
vi.mock("@/pages/setlists/RehearsalsPage", () => ({
  RehearsalFormDialog: () => null,
}));
vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: ({ open, onConfirm }: any) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        confirm-delete
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

/** The split-view panel instance (desktop node; a mobile sheet twin also renders in jsdom). */
function panel() {
  return screen.getAllByTestId("event-details-panel")[0];
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

describe("calendar split-view event panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEvents.mockResolvedValue({ events: [e1, e2] });
    mockListRehearsals.mockResolvedValue({ rehearsals: [] });
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve({
        event: id === "e1" ? { ...e1, location: "Main Hall", notes: "Bring the banners" } : { ...e2, location: "Chapel" },
      }),
    );
    mockDeleteEvent.mockResolvedValue({ message: "ok" });
    mockCreateEvent.mockResolvedValue({ event: { ...e1, id: "e3", title: "Morning worship (copy)" } });
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "admin" },
    };
  });

  it("opens the details panel on event click instead of navigating", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));

    await waitFor(() => {
      expect(screen.getAllByTestId("event-details-panel").length).toBeGreaterThan(0);
    });
    expect(mockGetEvent).toHaveBeenCalledWith("e1");
    await waitFor(() => {
      expect(within(panel()).getByText("Main Hall")).toBeInTheDocument();
    });
    expect(within(panel()).getByText("Bring the banners")).toBeInTheDocument();
  });

  it("clicking another event updates the same panel", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(mockGetEvent).toHaveBeenCalledWith("e1"));

    fireEvent.click(screen.getByText("Evening prayer"));
    await waitFor(() => expect(mockGetEvent).toHaveBeenCalledWith("e2"));
    await waitFor(() => {
      expect(within(panel()).getByText("Chapel")).toBeInTheDocument();
    });
    // Same single split-view panel (plus its mobile twin), not stacked panels
    expect(screen.getAllByTestId("event-details-panel").length).toBeLessThanOrEqual(2);
  });

  it("Escape closes the panel", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(screen.getAllByTestId("event-details-panel").length).toBeGreaterThan(0));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("event-details-panel")).not.toBeInTheDocument();
    });
  });

  it("duplicates the event from the panel footer", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(within(panel()).getByText("Duplicate")).toBeInTheDocument());

    fireEvent.click(within(panel()).getByText("Duplicate"));
    await waitFor(() => expect(mockCreateEvent).toHaveBeenCalledTimes(1));
    expect(mockCreateEvent.mock.calls[0][0].title).toBe("Morning worship (copy)");
  });

  it("deletes the event after confirmation and closes the panel", async () => {
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(within(panel()).getByText("Delete")).toBeInTheDocument());

    fireEvent.click(within(panel()).getByText("Delete"));
    fireEvent.click(await screen.findByText("confirm-delete"));
    await waitFor(() => expect(mockDeleteEvent).toHaveBeenCalledWith("e1"));
    await waitFor(() => {
      expect(screen.queryByTestId("event-details-panel")).not.toBeInTheDocument();
    });
  });

  it("hides edit/duplicate/delete for read-only roles", async () => {
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "observer" },
    };
    renderCalendar();
    fireEvent.click(await screen.findByText("Morning worship"));
    await waitFor(() => expect(screen.getAllByTestId("event-details-panel").length).toBeGreaterThan(0));

    expect(within(panel()).queryByText("Duplicate")).not.toBeInTheDocument();
    expect(within(panel()).queryByText("Delete")).not.toBeInTheDocument();
    expect(within(panel()).queryByLabelText("Edit event")).not.toBeInTheDocument();
    expect(within(panel()).getByLabelText("Close details panel")).toBeInTheDocument();
  });
});
