import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/ui/icon-btn";
import { getStatusAvatarColor, PIPELINE_HEX } from "./LeadsCardView";
import {
  Phone,
  Mail,
  Tag,
  Activity,
  User,
  ChevronRight,
  ChevronLeft,
  Users,
  Copy,
  Check,
  Smile,
  Meh,
  Frown,
  Clock,
  X,
} from "lucide-react";

interface LeadInfoPanelProps {
  lead: Record<string, any> | null;
  onClose: () => void;
  totalLeads: number;
  leads: Record<string, any>[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  New: { bg: "bg-gray-500/15", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-500" },
  Contacted: { bg: "bg-indigo-600/15", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-600" },
  Responded: { bg: "bg-teal-500/15", text: "text-teal-600 dark:text-teal-400", dot: "bg-teal-500" },
  "Multiple Responses": { bg: "bg-green-500/15", text: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  Qualified: { bg: "bg-lime-500/15", text: "text-lime-600 dark:text-lime-400", dot: "bg-lime-500" },
  Booked: { bg: "bg-amber-400/20", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  Closed: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  Lost: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  DND: { bg: "bg-zinc-500/15", text: "text-zinc-600 dark:text-zinc-400", dot: "bg-zinc-500" },
};

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "";
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value]
  );
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/contact:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground ml-auto flex-shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SentimentBadge({ value }: { value: string }) {
  const lower = (value || "").toLowerCase();
  if (lower.includes("positive") || lower === "positive") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Smile className="h-2.5 w-2.5" /> Positive
      </span>
    );
  }
  if (lower.includes("negative") || lower === "negative") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400">
        <Frown className="h-2.5 w-2.5" /> Negative
      </span>
    );
  }
  if (lower) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
        <Meh className="h-2.5 w-2.5" /> Neutral
      </span>
    );
  }
  return null;
}

function StatusBadge({ label }: { label: string }) {
  const colors = STATUS_COLORS[label] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };
  const hex = PIPELINE_HEX[label];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", colors.bg, colors.text)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={hex ? { backgroundColor: hex } : {}} />
      {label}
    </span>
  );
}

export function LeadInfoPanel({ lead, onClose, totalLeads, leads }: LeadInfoPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const fullName = lead
    ? lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"
    : null;

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    const s = l.conversion_status || l.Conversion_Status || "Unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-9 flex flex-col items-center pt-2 border-l border-border bg-card rounded-xl">
        <IconBtn
          onClick={() => setCollapsed(false)}
          title="Expand panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </IconBtn>
      </div>
    );
  }

  // Derived values for lead detail view
  const status = lead ? (lead.conversion_status || lead.Conversion_Status || "") : "";
  const score = lead ? Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0) : 0;
  const sentiment = lead ? (lead.ai_sentiment || lead.aiSentiment || lead.Ai_Sentiment || "") : "";
  const lastActivity = lead
    ? (lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at)
    : null;
  const initials = fullName
    ? fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div
      className="flex-shrink-0 w-72 flex flex-col rounded-xl border border-border bg-card overflow-hidden"
      data-testid="lead-info-panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {lead ? "Lead Detail" : "Leads Overview"}
        </span>
        <div className="flex items-center gap-1">
          {lead && (
            <IconBtn
              onClick={onClose}
              title="Deselect lead"
            >
              <X className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn
            onClick={() => setCollapsed(true)}
            title="Collapse panel"
          >
            <ChevronRight className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!lead ? (
          /* No lead selected — show overview */
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium text-foreground">{totalLeads} leads</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Click a row to view lead details here.
            </p>
            {/* Status breakdown */}
            {Object.keys(STATUS_COLORS).filter(s => statusCounts[s] > 0).map((status) => (
              <div key={status} className="flex items-center justify-between gap-2">
                <StatusBadge label={status} />
                <span className="text-[12px] font-semibold tabular-nums text-foreground">
                  {statusCounts[status] || 0}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Lead selected — improved visual layout */
          <div className="space-y-3">
            {/* Avatar + name + status */}
            <div className="flex items-start gap-2.5">
              {(() => {
                const avatarColor = getStatusAvatarColor(status);
                return (
                  <div
                    className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                    style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                  >
                    {initials}
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-foreground truncate" data-testid="lead-info-name">
                  {fullName}
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {status && <StatusBadge label={status} />}
                  {sentiment && <SentimentBadge value={sentiment} />}
                </div>
              </div>
            </div>

            {/* Score bar */}
            {score > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Score</span>
                  <span className={cn("text-xs font-bold tabular-nums", scoreTextColor(score))}>{score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-[width]", scoreBarColor(score))}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Contact info */}
            <div className="space-y-1.5">
              {lead.phone && (
                <div className="group/contact flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="font-mono truncate" data-testid="lead-info-phone">{lead.phone}</span>
                  <CopyButton value={lead.phone} />
                </div>
              )}
              {(lead.email || lead.Email) && (
                <div className="group/contact flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate" data-testid="lead-info-email">{lead.email || lead.Email}</span>
                  <CopyButton value={lead.email || lead.Email} />
                </div>
              )}
            </div>

            {/* Key fields grid */}
            <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1.5 text-[12px]">
              {lead.priority && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Priority
                  </span>
                  <span className="font-medium capitalize">{lead.priority}</span>
                </div>
              )}
              {lead.Account && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Account
                  </span>
                  <span className="font-medium truncate max-w-[120px]">{lead.Account}</span>
                </div>
              )}
              {lead.Campaign && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Campaign
                  </span>
                  <span className="font-medium truncate max-w-[120px]">{lead.Campaign}</span>
                </div>
              )}
              {lastActivity && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last active
                  </span>
                  <span className="font-mono text-[10px]">{formatRelativeTime(lastActivity)}</span>
                </div>
              )}
            </div>

            {/* Notes preview */}
            {lead.notes && (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
                <p className="text-[12px] text-foreground/80 leading-relaxed line-clamp-4">{lead.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
