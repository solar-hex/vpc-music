import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CalendarPage } from "@/pages/setlists/CalendarPage";

const mockListEvents = vi.fn();
const mockUpdateEvent = vi.fn();
const mockListRehearsals = vi.fn();

vi.mock("@/lib/api-client", () => ({
  eventsApi: {
    list: (...args: any[]) => mockListEvents(...args),
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
  EventFormDialog: () => null,
}));
vi.mock("@/pages/setlists/RehearsalsPage", () => ({
  RehearsalFormDialog: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// A mid-month event at 10:00 local time in the currently displayed month.
const now = new Date();
const eventDate = new Date(now.getFullYear(), now.getMonth(), 10, 10, 0, 0);
const targetDay = new Date(now.getFullYear(), now.getMonth(), 15);
const pad = (n: number) => String(n).padStart(2, "0");
const targetKey = `${targetDay.getFullYear()}-${pad(targetDay.getMonth() + 1)}-${pad(targetDay.getDate())}`;

/** Minimal DataTransfer stand-in — jsdom doesn't implement drag-and-drop. */
function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? "",
    get types() {
      return Object.keys(store);
    },
    effectAllowed: "",
    dropEffect: "",
  };
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

describe("calendar event drag-and-drop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEvents.mockResolvedValue({
      events: [{ id: "e1", title: "Sunday Service", date: eventDate.toISOString(), status: "scheduled" }],
    });
    mockListRehearsals.mockResolvedValue({ rehearsals: [] });
    mockUpdateEvent.mockResolvedValue({ event: {} });
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "admin" },
    };
  });

  it("moves an event to the dropped day, preserving its time", async () => {
    renderCalendar();
    const chip = await screen.findByText("Sunday Service");
    const cells = document.querySelectorAll(".grid.grid-cols-7.border-t > div");
    const target = Array.from(cells).find((cell) => cell.textContent === String(targetDay.getDate()));
    expect(target).toBeTruthy();

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(chip, { dataTransfer });
    fireEvent.dragOver(target!, { dataTransfer });
    fireEvent.drop(target!, { dataTransfer });

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    });
    const [id, payload] = mockUpdateEvent.mock.calls[0];
    expect(id).toBe("e1");
    const newDate = new Date(payload.date);
    expect(newDate.getHours()).toBe(10); // wall-clock time preserved
    expect(`${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}`).toBe(targetKey);
  });

  it("reverts the optimistic move when the update fails", async () => {
    mockUpdateEvent.mockRejectedValue(new Error("nope"));
    renderCalendar();
    const chip = await screen.findByText("Sunday Service");
    const cells = document.querySelectorAll(".grid.grid-cols-7.border-t > div");
    const target = Array.from(cells).find((cell) => cell.textContent === String(targetDay.getDate()));

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(chip, { dataTransfer });
    fireEvent.drop(target!, { dataTransfer });

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalled();
    });
    // The chip is back on its original day (the cell containing the 10th)
    const originCell = Array.from(cells).find((cell) => cell.textContent?.includes(String(eventDate.getDate())) && cell.textContent?.includes("Sunday Service"));
    expect(originCell).toBeTruthy();
  });

  it("does not allow dragging for read-only roles", async () => {
    mockAuthValue = {
      user: { id: "u1", role: "member" },
      activeOrg: { id: "org1", role: "observer" },
    };
    renderCalendar();
    const chip = await screen.findByText("Sunday Service");
    expect(chip).not.toHaveAttribute("draggable", "true");
  });
});
