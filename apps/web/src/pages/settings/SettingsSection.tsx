import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: ReactNode;
  children: ReactNode;
}

/** One card on the settings page: the panel of one tab. */
export function SettingsSection({ id, title, icon: Icon, description, children }: SettingsSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6"
    >
      <div>
        <h2 id={`${id}-heading`} className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <Icon className="h-5 w-5 text-[hsl(var(--secondary))]" aria-hidden="true" />
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>}
      </div>
      {children}
    </section>
  );
}
