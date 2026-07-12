import { Plug, Calendar, HardDrive, MessageSquare } from "lucide-react";

const INTEGRATIONS = [
  {
    name: "Calendar sync",
    icon: Calendar,
    description: "Publish events and rehearsals to your team's calendars.",
  },
  {
    name: "Cloud storage",
    icon: HardDrive,
    description: "Back charts and audio with your own storage provider.",
  },
  {
    name: "Team chat",
    icon: MessageSquare,
    description: "Send setlist approvals and event reminders to your chat tool.",
  },
];

/** Settings → Integrations: placeholder shells for future connections. */
export function SettingsIntegrationsTab() {
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Connections to outside tools will live here. None are available yet.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          return (
            <div key={integration.name} className="card card-body space-y-2 opacity-80">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-[hsl(var(--secondary))]" />
                <span className="font-medium">{integration.name}</span>
                <span className="badge badge-muted ml-auto">Coming soon</span>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{integration.description}</p>
              <button className="btn-outline btn-sm w-fit" disabled>
                <Plug className="h-4 w-4" /> Connect
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
