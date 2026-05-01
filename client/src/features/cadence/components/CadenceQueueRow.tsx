import { useState } from "react";
import { Phone, Mail, MessageCircle, Check, SkipForward, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProspectAvatar } from "@/features/prospects/components/ProspectAvatar";

interface CadenceQueueRowProps {
  prospect: any;
  onLogContact: (id: number, payload: { channel: string; notes?: string }) => void;
  onEnterCadence: (id: number) => void;
  onSkip: (id: number) => void;
}

const xBase =
  "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";

function getDueBadge(nextFollowUpDate: string | null) {
  if (!nextFollowUpDate) return null;
  const due = new Date(nextFollowUpDate);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterStart = new Date(tomorrowStart);
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);

  if (due < todayStart) return { label: "Overdue", cls: "bg-destructive/10 text-destructive" };
  if (due < tomorrowStart) return { label: "Today", cls: "bg-amber-100 text-amber-700" };
  if (due < dayAfterStart) return { label: "Tomorrow", cls: "bg-muted text-muted-foreground" };
  return { label: due.toLocaleDateString(), cls: "bg-muted text-muted-foreground" };
}

const CHANNEL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  call:      { icon: <Phone className="h-4 w-4" />,          label: "Phone" },
  email:     { icon: <Mail className="h-4 w-4" />,           label: "Email" },
  whatsapp:  { icon: <MessageCircle className="h-4 w-4" />,  label: "WhatsApp" },
};

export function CadenceQueueRow({ prospect, onLogContact, onEnterCadence, onSkip }: CadenceQueueRowProps) {
  const [notesOpen, setNotesOpen] = useState<string | null>(null); // channel key or null
  const [notes, setNotes] = useState("");

  const inCadence = !!prospect.sequence_started_at;
  const channel = prospect.next_channel as string;
  const channelMeta = CHANNEL_META[channel] ?? CHANNEL_META.call;
  const dueBadge = getDueBadge(prospect.next_follow_up_date ?? null);

  function handleLogWithNotes() {
    onLogContact(prospect.id, { channel, notes: notes.trim() || undefined });
    setNotesOpen(null);
    setNotes("");
  }

  function handleDone() {
    onLogContact(prospect.id, { channel });
  }

  return (
    <div className="border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 py-3 px-4 h-[52px]">
        {/* Left: avatar + name + company */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ProspectAvatar
            name={prospect.company ?? prospect.contact_name ?? "?"}
            website={prospect.website}
            outreachStatus={prospect.outreach_status}
            size={36}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">
              {prospect.contact_name ?? prospect.company}
            </p>
            {prospect.company && prospect.contact_name && (
              <p className="text-xs text-muted-foreground truncate leading-tight">{prospect.company}</p>
            )}
          </div>
        </div>

        {/* Center: step badge + channel + due */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Step {prospect.sequence_step ?? 1}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {channelMeta.icon}
            {channelMeta.label}
          </span>
          {dueBadge && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", dueBadge.cls)}>
              {dueBadge.label}
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {!inCadence ? (
            <button
              className={cn(xBase, xDefault, "hover:max-w-[140px]")}
              onClick={() => onEnterCadence(prospect.id)}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                Add to Cadence
              </span>
            </button>
          ) : (
            <>
              {(channel === "call" || channel === "whatsapp" || channel === "email") && (
                <button
                  className={cn(xBase, xDefault, "hover:max-w-[120px]")}
                  onClick={() => setNotesOpen(notesOpen === channel ? null : channel)}
                >
                  {channelMeta.icon}
                  <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    Log {channelMeta.label}
                  </span>
                </button>
              )}
              <button
                className={cn(xBase, xDefault, "hover:max-w-[80px]")}
                onClick={handleDone}
              >
                <Check className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Done
                </span>
              </button>
              <button
                className={cn(xBase, xDefault, "hover:max-w-[80px]")}
                onClick={() => onSkip(prospect.id)}
              >
                <SkipForward className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Skip
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline notes expansion */}
      {notesOpen && (
        <div className="px-4 pb-3 flex items-end gap-2">
          <textarea
            className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
            rows={2}
            placeholder="Add notes (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus
          />
          <Button
            size="sm"
            className="h-9 rounded-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
            onClick={handleLogWithNotes}
          >
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
}
