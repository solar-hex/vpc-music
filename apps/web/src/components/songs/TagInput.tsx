import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import { X, ChevronDown } from "lucide-react";
import { PRESET_TAGS } from "@vpc-music/shared";
import { songsApi } from "@/lib/api-client";

interface TagInputProps {
  /** Comma-separated tag string (matches DB format) */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Multi-select tag input with:
 * - Pill display for selected tags
 * - Enter / comma to add typed tags
 * - Preset tag suggestions
 * - Existing tags from the database merged in
 * - Click-to-remove pills
 */
export function TagInput({ value, onChange }: TagInputProps) {
  // ── Selected tags derived from comma-separated string ──────
  const tags = useMemo(
    () =>
      value
        ? value
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : [],
    [value],
  );

  // ── Input state ────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Existing tags fetched from DB ──────────────────────────
  const [existingTags, setExistingTags] = useState<string[]>([]);

  useEffect(() => {
    songsApi
      .getTags()
      .then((res) => setExistingTags(res.tags))
      .catch(() => {
        /* ignore — presets still available */
      });
  }, []);

  // ── Build the full suggestion list (presets + existing, deduplicated) ──
  const allSuggestions = Array.from(
    new Set([...PRESET_TAGS.map((t) => t.toLowerCase()), ...existingTags]),
  ).sort();

  // ── Filter suggestions based on input and exclude already-selected ──
  const filteredSuggestions = allSuggestions.filter(
    (s) =>
      !tags.includes(s) &&
      (input.trim() === "" || s.includes(input.trim().toLowerCase())),
  );

  // ── Helpers ────────────────────────────────────────────────
  const emitChange = useCallback(
    (newTags: string[]) => {
      onChange(newTags.join(","));
    },
    [onChange],
  );

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized || tags.includes(normalized)) return;
      emitChange([...tags, normalized]);
      setInput("");
    },
    [tags, emitChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      emitChange(tags.filter((t) => t !== tag));
    },
    [tags, emitChange],
  );

  // ── Keyboard handling ──────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(input);
      } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
        // Remove last tag on Backspace when input is empty
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setDropdownOpen(false);
        inputRef.current?.blur();
      }
    },
    [input, tags, addTag, removeTag],
  );

  // ── Close dropdown on outside click ────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[hsl(var(--foreground))]">Tags</label>

      <div className="relative" ref={containerRef}>
        {/* Pill container + input */}
        <div
          className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1.5 focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]"
          onClick={() => inputRef.current?.focus()}
          data-testid="tag-input-container"
        >
          {/* Selected tag pills */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--secondary-foreground))]"
              data-testid="tag-pill"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                aria-label={`Remove ${tag}`}
                data-testid={`tag-remove-${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (!dropdownOpen) setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "Add tags..." : ""}
            className="min-w-20 flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
            data-testid="tag-text-input"
          />

          {/* Dropdown toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="ml-auto shrink-0 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            data-testid="tag-dropdown-toggle"
            aria-label="Toggle tag suggestions"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Suggestion dropdown */}
        {dropdownOpen && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg"
            data-testid="tag-suggestions"
          >
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  addTag(suggestion);
                  inputRef.current?.focus();
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
                data-testid={`tag-suggestion-${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Type and press Enter to add • Click suggestions to select • Click × to remove
      </p>
    </div>
  );
}
