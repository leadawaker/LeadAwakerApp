import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, FileText, ArrowUpRight, ArrowDownLeft, ExternalLink, ChevronDown, ChevronRight, Linkedin, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

interface Interaction {
  id: number;
  type: "email" | "sms" | "call" | "note" | "whatsapp" | "linkedin";
  direction: "inbound" | "outbound";
  Content: string;
  created_at: string;
  sent_at?: string;
  metadata?: Record<string, unknown>;
}

interface OutreachTimelineProps {
  prospectId: number;
  refreshKey?: number;
}

function typeIcon(type: string) {
  if (type === "call") return Phone;
  if (type === "note") return FileText;
  if (type === "whatsapp") return MessageSquare;
  if (type === "linkedin") return Linkedin;
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

export function OutreachTimeline({ prospectId, refreshKey }: OutreachTimelineProps) {
  const { t } = useTranslation("prospects");
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/interactions?prospect_id=${prospectId}&limit=50`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : data.interactions ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [prospectId, refreshKey]);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-4 w-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
      </div>
    );
  }

  const typeIconColors: Record<string, { bg: string; icon: string }> = {
    email: { bg: "bg-blue-100 dark:bg-blue-900/30", icon: "text-blue-600 dark:text-blue-400" },
    whatsapp: { bg: "bg-green-100 dark:bg-green-900/30", icon: "text-green-600 dark:text-green-400" },
    call: { bg: "bg-purple-100 dark:bg-purple-900/30", icon: "text-purple-600 dark:text-purple-400" },
    sms: { bg: "bg-emerald-100 dark:bg-emerald-900/30", icon: "text-emerald-600 dark:text-emerald-400" },
    note: { bg: "bg-amber-100 dark:bg-amber-900/30", icon: "text-amber-600 dark:text-amber-400" },
    linkedin: { bg: "bg-sky-100 dark:bg-sky-900/30", icon: "text-[#0A66C2] dark:text-[#0A66C2]" },
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2 rounded-lg border border-dashed border-border/40 bg-muted/20">
        <Inbox className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-[13px] font-medium text-foreground/70">
          {t("outreachTimeline.emptyTitle", "No outreach yet")}
        </p>
        <p className="text-[11px] text-muted-foreground/60 max-w-[220px]">
          {t("outreachTimeline.emptyHint", "Sent emails, WhatsApp messages, calls, and notes will show up here.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = typeIcon(item.type);
        const DirIcon = item.direction === "outbound" ? ArrowUpRight : ArrowDownLeft;
        const ts = item.sent_at || item.created_at;
        const subject = (item.metadata as { subject?: string })?.subject;
        const snippet = subject || item.Content;
        const colors = typeIconColors[item.type] ?? { bg: "bg-muted/60", icon: "text-muted-foreground/60" };
        const isExpanded = expandedIds.has(item.id);

        return (
          <div key={item.id} className="rounded-lg border border-border/40 bg-white/50 dark:bg-card/50 overflow-hidden">
            {/* Collapsed row — always visible */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              onClick={() => toggleExpanded(item.id)}
            >
              {/* Type icon */}
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0", colors.bg)}>
                <Icon className={cn("h-2.5 w-2.5", colors.icon)} />
              </div>
              {/* Direction icon */}
              <DirIcon className={cn("h-3 w-3 shrink-0", item.direction === "outbound" ? "text-brand-indigo/50" : "text-emerald-500/60")} />
              {/* Snippet */}
              <span className="flex-1 text-[11px] text-foreground/70 truncate">{snippet}</span>
              {/* Timestamp */}
              <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">{relativeTime(ts)}</span>
              {/* Open in conversations */}
              <a
                href={`${window.location.pathname.startsWith("/agency") ? "/agency" : "/subaccount"}/conversations?tab=prospects&prospectId=${prospectId}`}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-brand-indigo transition-colors shrink-0"
                title={t("interactions.openConversations", "Open in conversations")}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              {/* Expand chevron */}
              {isExpanded
                ? <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                : <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              }
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-2.5 pt-1 border-t border-border/30">
                {subject && (
                  <p className="text-[11px] font-semibold text-foreground/80 mb-1">{subject}</p>
                )}
                <p className="text-[12px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{item.Content}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
