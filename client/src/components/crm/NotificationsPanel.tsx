import { X } from "lucide-react";

type NotificationItem = {
  id: number;
  title: string;
  description: string;
  at: string;
};

const mockNotifications: NotificationItem[] = [
  {
    id: 1,
    title: "New inbound reply",
    description: "Lead replied: ‘Ok, send me the link.’",
    at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    title: "Automation error",
    description: "Twilio delivery failed (mock).",
    at: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    title: "Booked appointment",
    description: "A lead booked a call from the calendar link.",
    at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export function NotificationsPanel({
  open,
  onClose,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" data-testid="overlay-notifications">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        data-testid="button-notifications-backdrop"
        aria-label="Close notifications"
      />

      <div className="fixed left-0 top-0 bottom-0 w-[48px] pointer-events-none" data-testid="keep-edgebar-white" />

      <aside
        className="absolute left-[48px] top-0 bottom-0 w-[340px] max-w-[calc(100vw-48px)] border-r border-border bg-background shadow-xl"
        data-testid="panel-notifications"
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-border">
          <button
            type="button"
            className="h-9 px-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 text-xs font-semibold"
            onClick={onMarkAllRead}
            data-testid="button-mark-all-read"
          >
            Mark all as read
          </button>
          <div className="font-semibold" data-testid="text-notifications-title">Notifications</div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center"
            data-testid="button-notifications-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 space-y-2 overflow-auto h-[calc(100%-56px)]" data-testid="list-notifications">
          {mockNotifications.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-border bg-muted/10 p-3"
              data-testid={`card-notification-${n.id}`}
            >
              <div className="text-sm font-semibold" data-testid={`text-notification-title-${n.id}`}>{n.title}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-notification-desc-${n.id}`}>{n.description}</div>
              <div className="mt-2 text-[11px] text-muted-foreground" data-testid={`text-notification-at-${n.id}`}>
                {new Date(n.at).toLocaleString()}
              </div>
            </div>
          ))}

          <div className="pt-2 text-xs text-muted-foreground" data-testid="text-notifications-real">
            REAL: notifications derived from Interactions + Automation_Logs
          </div>
        </div>
      </aside>
    </div>
  );
}
