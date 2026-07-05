import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2, X, CalendarDays, Users, ListMusic, Info } from "lucide-react";
import { notificationsApi, type AppNotification } from "@/lib/api-client";

const TYPE_ICONS = {
  event: CalendarDays,
  team: Users,
  setlist: ListMusic,
  system: Info,
} as const;

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Bell button + notification dropdown for the sidebar bottom bar. Polls every
 * minute via react-query; supports mark-read, mark-all, delete, and clear.
 */
export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ limit: 30 }),
    refetchInterval: 60_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const handleOpen = async (notification: AppNotification) => {
    setOpen(false);
    if (!notification.readAt) {
      await notificationsApi.markRead(notification.id).catch(() => {});
      refresh();
    }
    if (notification.linkPath) navigate(notification.linkPath);
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead().catch(() => {});
    refresh();
  };

  const handleDelete = async (id: string) => {
    await notificationsApi.delete(id).catch(() => {});
    refresh();
  };

  const handleClearAll = async () => {
    await notificationsApi.clearAll().catch(() => {});
    refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-icon relative rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--secondary))] px-1 text-[9px] font-bold text-[hsl(var(--secondary-foreground))]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-full right-0 mb-2 z-50 w-80 max-h-[420px] flex flex-col rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Mark all read">
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={handleClearAll} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Clear all">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                You're all caught up.
              </p>
            ) : (
              notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] ?? Info;
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-[hsl(var(--border))]/50 last:border-b-0 ${
                      notification.readAt ? "" : "bg-[hsl(var(--secondary))]/5"
                    }`}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--secondary))]" />
                    <button onClick={() => handleOpen(notification)} className="flex-1 min-w-0 text-left">
                      <p className={`text-xs leading-snug ${notification.readAt ? "text-[hsl(var(--muted-foreground))]" : "font-medium text-[hsl(var(--foreground))]"}`}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]/70 mt-0.5">{timeAgo(notification.createdAt)}</p>
                    </button>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!notification.readAt && (
                        <button
                          onClick={async () => {
                            await notificationsApi.markRead(notification.id).catch(() => {});
                            refresh();
                          }}
                          className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                          title="Mark read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
