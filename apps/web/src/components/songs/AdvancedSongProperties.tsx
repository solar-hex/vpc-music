import { ChevronDown } from "lucide-react";
import { ADVANCED_SONG_FIELDS, readDirective, writeDirective } from "@/lib/chart-directives";

interface AdvancedSongPropertiesProps {
  /** The chart text; every value here is read from it and written back to it. */
  content: string;
  onChange: (content: string) => void;
}

/**
 * The less common song properties, folded away under the tags: alternate
 * titles, subtitle, songwriters, album, time signature, length, copyright and
 * CCLI number.
 *
 * There is no copy of these in form state. Each field shows the directive in
 * the chart and writes the directive back, so typing `{time: 6/8}` into the
 * chart fills the field, filling the field adds the line, and the two can never
 * disagree. Clearing a field removes its line.
 */
export function AdvancedSongProperties({ content, onChange }: AdvancedSongPropertiesProps) {
  const values = ADVANCED_SONG_FIELDS.map((field) => readDirective(content, field.directive));
  const filled = values.filter((value) => value.trim()).length;

  return (
    <details className="group rounded-md border border-[hsl(var(--border))] sm:col-span-2" data-testid="advanced-properties">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-[hsl(var(--foreground))]">Advanced</span>
        <span className="min-w-0 flex-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {filled > 0 ? `${filled} set` : "Alternate titles, songwriters, album, time signature and more"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="grid gap-3 border-t border-[hsl(var(--border))] p-3 sm:grid-cols-2">
        {ADVANCED_SONG_FIELDS.map((field, index) => {
          const listId = field.suggestions ? `advanced-${field.directive}-options` : undefined;
          const update = (value: string) => {
            const next = writeDirective(content, field.directive, value);
            if (next !== content) onChange(next);
          };
          return (
            <label key={field.directive} className={`block text-sm ${field.directive === "x_aka" ? "sm:col-span-2" : ""}`}>
              <span className="mb-1 block text-[hsl(var(--muted-foreground))]">{field.label}</span>
              <input
                value={values[index]}
                onChange={(event) => update(event.target.value)}
                // Spaces are kept while typing and tidied when the field is left.
                onBlur={(event) => update(event.target.value.trim())}
                className="input w-full"
                aria-label={field.label}
                placeholder={field.placeholder}
                inputMode={field.inputMode}
                list={listId}
              />
              {field.suggestions && (
                <datalist id={listId}>
                  {field.suggestions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              )}
              {field.hint && <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{field.hint}</span>}
            </label>
          );
        })}
        <p className="text-xs text-[hsl(var(--muted-foreground))] sm:col-span-2">
          Saved in the chart itself, so they travel with it.
        </p>
      </div>
    </details>
  );
}
