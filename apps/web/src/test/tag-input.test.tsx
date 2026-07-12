import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "@/components/songs/TagInput";

// ---------- Mocks ----------
const mockGetTags = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    getTags: (...args: any[]) => mockGetTags(...args),
  },
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  PRESET_TAGS: [
    "worship",
    "praise",
    "hymn",
    "classic",
    "contemporary",
    "gospel",
    "christmas",
    "fast",
    "slow",
  ],
}));

function renderTagInput(props: Partial<React.ComponentProps<typeof TagInput>> = {}) {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    ...props,
  };
  return {
    ...render(<TagInput {...defaultProps} />),
    onChange: defaultProps.onChange,
  };
}

describe("TagInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTags.mockResolvedValue({ tags: ["bethel", "hillsong", "worship"] });
  });

  // ===================== Rendering =====================

  describe("rendering", () => {
    it("renders the tag input container", () => {
      renderTagInput();
      expect(screen.getByTestId("tag-input-container")).toBeInTheDocument();
    });

    it("renders the text input", () => {
      renderTagInput();
      expect(screen.getByTestId("tag-text-input")).toBeInTheDocument();
    });

    it("renders the dropdown toggle", () => {
      renderTagInput();
      expect(screen.getByTestId("tag-dropdown-toggle")).toBeInTheDocument();
    });

    it("renders the label", () => {
      renderTagInput();
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });

    it("renders the hint text", () => {
      renderTagInput();
      expect(screen.getByText(/type and press enter to add/i)).toBeInTheDocument();
    });

    it("shows placeholder when no tags selected", () => {
      renderTagInput();
      expect(screen.getByPlaceholderText("Add tags...")).toBeInTheDocument();
    });

    it("hides placeholder when tags exist", () => {
      renderTagInput({ value: "worship" });
      expect(screen.queryByPlaceholderText("Add tags...")).not.toBeInTheDocument();
    });
  });

  // ===================== Tag Pills =====================

  describe("tag pills", () => {
    it("renders pills for existing tags", () => {
      renderTagInput({ value: "worship,hymn,classic" });
      const pills = screen.getAllByTestId("tag-pill");
      expect(pills).toHaveLength(3);
      expect(screen.getByText("worship")).toBeInTheDocument();
      expect(screen.getByText("hymn")).toBeInTheDocument();
      expect(screen.getByText("classic")).toBeInTheDocument();
    });

    it("renders remove button for each pill", () => {
      renderTagInput({ value: "worship,hymn" });
      expect(screen.getByTestId("tag-remove-worship")).toBeInTheDocument();
      expect(screen.getByTestId("tag-remove-hymn")).toBeInTheDocument();
    });

    it("removes a tag when clicking the × button", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "worship,hymn,classic", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-remove-hymn"));
      expect(onChange).toHaveBeenCalledWith("worship,classic");
    });

    it("removes the last pill on Backspace when input is empty", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "worship,hymn", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.click(input);
      await user.keyboard("{Backspace}");
      expect(onChange).toHaveBeenCalledWith("worship");
    });
  });

  // ===================== Adding Tags =====================

  describe("adding tags", () => {
    it("adds a tag on Enter", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "newtag");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("newtag");
    });

    it("adds a tag on comma", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "newtag,");
      expect(onChange).toHaveBeenCalledWith("newtag");
    });

    it("normalizes tags to lowercase", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "WORSHIP");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("worship");
    });

    it("does not add duplicate tags", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "worship", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "worship");
      await user.keyboard("{Enter}");
      // Should not call onChange since "worship" already exists
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not add empty tags", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.click(input);
      await user.keyboard("{Enter}");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("trims whitespace from tags", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "  worship  ");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("worship");
    });

    it("appends to existing tags", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "worship", onChange });
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "hymn");
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledWith("worship,hymn");
    });
  });

  // ===================== Suggestions Dropdown =====================

  describe("suggestions dropdown", () => {
    it("opens dropdown on input focus", async () => {
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestions")).toBeInTheDocument();
      });
    });

    it("opens dropdown on toggle button click", async () => {
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-dropdown-toggle"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestions")).toBeInTheDocument();
      });
    });

    it("shows preset tags as suggestions", async () => {
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestion-worship")).toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-hymn")).toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-contemporary")).toBeInTheDocument();
      });
    });

    it("filters suggestions based on input", async () => {
      renderTagInput();
      const user = userEvent.setup();
      const input = screen.getByTestId("tag-text-input");
      await user.type(input, "wor");
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestion-worship")).toBeInTheDocument();
        expect(screen.queryByTestId("tag-suggestion-hymn")).not.toBeInTheDocument();
      });
    });

    it("excludes already-selected tags from suggestions", async () => {
      renderTagInput({ value: "worship,hymn" });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.queryByTestId("tag-suggestion-worship")).not.toBeInTheDocument();
        expect(screen.queryByTestId("tag-suggestion-hymn")).not.toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-praise")).toBeInTheDocument();
      });
    });

    it("adds tag when clicking a suggestion", async () => {
      const onChange = vi.fn();
      renderTagInput({ value: "", onChange });
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestion-worship")).toBeInTheDocument();
      });
      await user.click(screen.getByTestId("tag-suggestion-worship"));
      expect(onChange).toHaveBeenCalledWith("worship");
    });

    it("merges existing DB tags into suggestions", async () => {
      mockGetTags.mockResolvedValue({ tags: ["bethel", "hillsong"] });
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestion-bethel")).toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-hillsong")).toBeInTheDocument();
      });
    });

    it("deduplicates tags between presets and DB", async () => {
      // "worship" exists in both presets and DB
      mockGetTags.mockResolvedValue({ tags: ["worship", "bethel"] });
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        const worshipSuggestions = screen.getAllByTestId("tag-suggestion-worship");
        expect(worshipSuggestions).toHaveLength(1);
      });
    });

    it("closes dropdown on Escape", async () => {
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestions")).toBeInTheDocument();
      });
      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("tag-suggestions")).not.toBeInTheDocument();
    });

    it("handles API failure gracefully — still shows presets", async () => {
      mockGetTags.mockRejectedValue(new Error("Network error"));
      renderTagInput();
      const user = userEvent.setup();
      await user.click(screen.getByTestId("tag-text-input"));
      await waitFor(() => {
        expect(screen.getByTestId("tag-suggestion-worship")).toBeInTheDocument();
      });
    });
  });

  // ===================== Edge Cases =====================

  describe("edge cases", () => {
    it("handles empty string value", () => {
      expect(() => renderTagInput({ value: "" })).not.toThrow();
      expect(screen.queryByTestId("tag-pill")).not.toBeInTheDocument();
    });

    it("handles value with trailing comma", () => {
      renderTagInput({ value: "worship,hymn," });
      const pills = screen.getAllByTestId("tag-pill");
      expect(pills).toHaveLength(2); // empty trailing segment is filtered
    });

    it("handles value with extra spaces", () => {
      renderTagInput({ value: " worship , hymn , classic " });
      const pills = screen.getAllByTestId("tag-pill");
      expect(pills).toHaveLength(3);
    });

    it("fetches tags from API on mount", () => {
      renderTagInput();
      expect(mockGetTags).toHaveBeenCalledTimes(1);
    });
  });
});
