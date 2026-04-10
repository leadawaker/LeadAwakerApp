import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, FileText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

interface Interaction {
  id: number;
  type: "email" | "sms" | "call" | "note" | "whatsapp";
  direction: "inbound" | "outbound";
  content: string;
  created_at: string;
  sent_at?: string;
  metadata?: Record<string, unknown>;
}

interface OutreachTimelineProps {
  prospectId: number;
}

function typeIcon(type: string) {
  if (type === "call") return Phone;
  if (type === "note") return FileText;
  if (type === "whatsapp") return MessageSquare;
  return Mail;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function OutreachTimeline({ prospectId }: OutreachTimelineProps) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/interactions?prospect_id=${prospectId}&limit=50`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : data.interactions ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [prospectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-4 w-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground/40 italic">No outreach logged yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const Icon = typeIcon(item.type);
        const DirIcon = item.direction === "outbound" ? ArrowUpRight : ArrowDownLeft;
        const ts = item.sent_at || item.created_at;
        const subject = (item.metadata as { subject?: string })?.subject;
        const snippet = subject || item.content;
        return (
          <div key={item.id} className="flex gap-2 items-start">
            <div className="flex flex-col items-center gap-0.5 mt-0.5 shrink-0">
              <div className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center">
                <Icon className="h-3 w-3 text-muted-foreground/60" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <DirIcon className={cn("h-3 w-3 shrink-0", item.direction === "outbound" ? "text-brand-indigo/60" : "text-emerald-500/60")} />
                <span className="text-[9px] text-muted-foreground/40 tabular-nums ml-auto">{relativeTime(ts)}</span>
              </div>
              <p className="text-[11px] text-foreground/70 leading-snug line-clamp-2">{snippet}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
