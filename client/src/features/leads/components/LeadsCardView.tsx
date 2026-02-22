import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  X,
  Search,
  Users,
  BookUser,
  MessageSquare,
  Copy,
  Check,
  Star,
  Target,
  ChevronRight,
  Send,
  Bot,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { useInteractions } from "@/hooks/useApiData";
import { sendMessage } from "@/features/conversations/api/conversationsApi";
import type { Interaction } from "@/types/models";

interface LeadsCardViewProps {
  leads: Record<string, any>[];
  loading: boolean;
  selectedLead: Record<string, any> | null;
  onSelectLead: (lead: Record<string, any>) => void;
  onClose: () => void;
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
}

// ── Pipeline stages ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "New",                short: "New" },
  { key: "Contacted",          short: "Contacted" },
  { key: "Responded",          short: "Responded" },
  { key: "Multiple Responses", short: "Multi" },
  { key: "Qualified",          short: "Qualified" },
  { key: "Booked",             short: "Booked ★" },
];
const LOST_STAGES = ["Lost", "DND"];

// ── Status colour map ──────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string }> = {
  New:                  { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  Contacted:            { bg: "bg-indigo-500/10",  text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" },
  Responded:            { bg: "bg-violet-500/10",  text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500",  badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
  "Multiple Responses": { bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
  Qualified:            { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  Booked:               { bg: "bg-amber-400/15",   text: "text-amber-700 dark:text-amber-400",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  Lost:                 { bg: "bg-red-500/10",     text: "text-red-700 dark:text-red-400",      dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  DND:                  { bg: "bg-zinc-500/10",    text: "text-zinc-600 dark:text-zinc-400",    dot: "bg-zinc-500",    badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

// ── Avatar gradient palettes ───────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-indigo-500 to-blue-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-violet-600",
  "from-cyan-500 to-blue-600",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLeadId(lead: Record<string, any>): number {
  return lead.Id ?? lead.id ?? 0;
}
function getFullName(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}
function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}
function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}
function getSubtitle(lead: Record<string, any>): string {
  return lead.email || lead.Email || lead.phone || "";
}
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}
function formatMsgTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ── Score Donut ───────────────────────────────────────────────────────────────
function ScoreDonut({ score }: { score: number }) {
  const r = 42, sw = 8, hw = 100;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "hsl(142 71% 45%)" : score >= 40 ? "hsl(38 90% 58%)" : "hsl(0 72% 55%)";
  const colorCls = score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500";
  const label = score >= 70 ? "High potential" : score >= 40 ? "Moderate interest" : "Needs nurturing";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: hw, height: hw }}>
        <svg viewBox={`0 0 ${hw} ${hw}`} className="absolute inset-0 -rotate-90" width={hw} height={hw}>
          <circle cx={hw/2} cy={hw/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
          <circle cx={hw/2} cy={hw/2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="relative text-center">
          <div className={cn("text-3xl font-black tabular-nums leading-none", colorCls)}>{score}</div>
          <div className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">/ 100</div>
        </div>
      </div>
      <div className={cn("text-[11px] font-semibold text-center", colorCls)}>{label}</div>
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyContactBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Status badge (light, for header) ─────────────────────────────────────────
function StatusBadge({ label }: { label: string }) {
  const c = STATUS_COLORS[label] ?? { badge: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", c.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot ?? "bg-muted-foreground")} />
      {label}
    </span>
  );
}

// ── Status dot (list panel) ────────────────────────────────────────────────────
function StatusDot({ label }: { label: string }) {
  const c = STATUS_COLORS[label] ?? { dot: "bg-muted-foreground", text: "text-muted-foreground" };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
      <span className={cn("text-[10px] font-medium", c.text)}>{label}</span>
    </span>
  );
}

// ── Pipeline funnel ────────────────────────────────────────────────────────────
function PipelineFunnel({ status }: { status: string }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isLost = LOST_STAGES.includes(status);

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {PIPELINE_STAGES.map((stage, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={stage.key} className="flex items-center gap-0 shrink-0">
            {i > 0 && (
              <div className={cn(
                "h-px w-4 shrink-0",
                isPast ? "bg-indigo-300 dark:bg-indigo-700" : isCurrent ? "bg-indigo-300 dark:bg-indigo-700" : "bg-border/50"
              )} />
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors",
              isCurrent
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700"
                : isPast
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground/50"
            )}>
              {isPast && <Check className="h-2.5 w-2.5 shrink-0" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
              {stage.short}
            </div>
          </div>
        );
      })}

      {/* Lost / DND separate indicator */}
      {isLost && (
        <>
          <div className="h-px w-4 bg-red-300 dark:bg-red-800 shrink-0" />
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            {status}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────
const TAG_COLOR_MAP: Record<string, string> = {
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  gray:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
};
function TagPill({ tag }: { tag: { name: string; color: string } }) {
  const cls = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", cls)}>
      {tag.name}
    </span>
  );
}

// ── Contact widget ─────────────────────────────────────────────────────────────
function ContactWidget({ lead }: { lead: Record<string, any> }) {
  const phone = lead.phone || lead.Phone || "";
  const email = lead.email || lead.Email || "";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</p>
      {!phone && !email && (
        <p className="text-xs text-muted-foreground/60 italic">No contact info</p>
      )}
      {phone && (
        <div className="group/row flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0 ring-1 ring-indigo-100 dark:ring-indigo-900/50">
            <Phone className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground font-medium leading-none mb-0.5">Phone</div>
            <div className="font-mono text-[12px] text-foreground truncate">{phone}</div>
          </div>
          <CopyContactBtn value={phone} />
        </div>
      )}
      {email && (
        <div className="group/row flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0 ring-1 ring-blue-100 dark:ring-blue-900/50">
            <Mail className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted-foreground font-medium leading-none mb-0.5">Email</div>
            <div className="text-[12px] text-foreground truncate">{email}</div>
          </div>
          <CopyContactBtn value={email} />
        </div>
      )}
    </div>
  );
}

// ── Score widget ───────────────────────────────────────────────────────────────
function ScoreWidget({ score }: { score: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col items-center justify-center gap-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-start">Lead Score</p>
      <ScoreDonut score={score} />
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────────────────
function isAiMsg(item: Interaction): boolean {
  if (item.ai_generated) return true;
  if (item.is_bump) return true;
  if ((item.triggered_by || item.triggeredBy) === "Automation") return true;
  const who = ((item.Who ?? item.who) || "").toLowerCase();
  return ["ai", "bot", "automation"].includes(who);
}

function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  const isAi = isAiMsg(item);
  const ts = item.created_at || item.createdAt || "";

  return (
    <div className={cn("flex gap-2", outbound ? "flex-row-reverse" : "flex-row")} data-testid={`row-interaction-${item.id}`}>
      {/* Avatar */}
      {!outbound && (
        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <UserIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        </div>
      )}
      {outbound && (
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isAi ? "bg-indigo-100 dark:bg-indigo-900/40" : "bg-blue-100 dark:bg-blue-900/40"
        )}>
          {isAi
            ? <Bot className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
            : <UserIcon className="h-3 w-3 text-blue-500 dark:text-blue-400" />
          }
        </div>
      )}

      {/* Bubble */}
      <div className={cn("flex flex-col gap-0.5 max-w-[75%]", outbound ? "items-end" : "items-start")}>
        {outbound && (
          <div className="text-[9px] text-muted-foreground/70 flex items-center gap-1">
            {isAi ? "AI" : "Agent"} · {item.type || "WhatsApp"}
          </div>
        )}
        <div className={cn(
          "rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap",
          outbound
            ? isAi
              ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100 rounded-tr-sm"
              : "bg-brand-blue text-white rounded-tr-sm"
            : "bg-muted/70 text-foreground dark:bg-muted/50 rounded-tl-sm"
        )}>
          {item.content || item.Content || ""}
        </div>
        <div className="text-[10px] text-muted-foreground/60 tabular-nums">{formatMsgTime(ts)}</div>
      </div>
    </div>
  );
}

// ── Conversation widget ────────────────────────────────────────────────────────
function ConversationWidget({ lead }: { lead: Record<string, any> }) {
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sorted = useMemo(
    () => [...interactions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [interactions]
  );

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);
    try {
      const accountsId = Number(lead.account_id || lead.accounts_id || lead.Accounts_id || 0);
      await sendMessage({
        leadsId: leadId,
        accountsId,
        content,
        type: "WhatsApp",
        direction: "Outbound",
        status: "sent",
        who: "Agent",
      });
      await refresh();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, sending, leadId, lead, refresh]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
        data-testid="list-interactions"
      >
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {[70, 50, 80, 55].map((w, i) => (
              <div
                key={i}
                className={cn("flex", i % 2 === 0 ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className="h-8 rounded-2xl bg-muted/60 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground/60">Messages will appear here once outreach begins</p>
          </div>
        ) : (
          sorted.map((item) => <ChatBubble key={item.id} item={item} />)
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-border/40 p-3 flex items-end gap-2 bg-background/60 shrink-0">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Auto-resize
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="flex-1 text-[12px] bg-muted/50 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40 border border-border/40 placeholder:text-muted-foreground/50 transition-all"
          style={{ minHeight: "36px", maxHeight: "80px" }}
          data-testid="input-message-compose"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="h-9 w-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40 shrink-0 transition-colors"
          title="Send message"
          data-testid="btn-send-message"
        >
          {sending
            ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Send className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyDetailState({ leadsCount }: { leadsCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 flex items-center justify-center ring-1 ring-indigo-200/50 dark:ring-indigo-800/30">
          <BookUser className="h-10 w-10 text-indigo-400 dark:text-indigo-500" />
        </div>
        <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center shadow-md ring-2 ring-background">
          <span className="text-[10px] font-bold text-white">{leadsCount > 99 ? "99+" : leadsCount}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Select a lead</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any lead in the list to see their profile, score, and messages.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 dark:text-indigo-500 font-medium">
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        <span>Choose from the list</span>
      </div>
    </div>
  );
}

// ── Full lead detail view ──────────────────────────────────────────────────────
function LeadDetailView({
  lead,
  onClose,
  leadTags,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
}) {
  const name = getFullName(lead);
  const initials = getInitials(name);
  const status = getStatus(lead);
  const score = getScore(lead);
  const gradient = getAvatarGradient(name);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;
  const sentiment = lead.ai_sentiment || lead.aiSentiment || "";
  const isBooked = status === "Booked";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header — D365-style soft mint gradient ── */}
      <div className="shrink-0 relative overflow-hidden border-b border-border/30">
        {/* Layered gradient: soft mint/teal like D365 reference */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50/40 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(167,243,208,0.35)_0%,_transparent_65%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent dark:via-emerald-800/30" />

        {/* Content sits above gradients */}
        <div className="relative px-4 pt-4 pb-3 space-y-2.5">

          {/* Row 1: Avatar + Name + Close */}
          <div className="flex items-start gap-3.5">
            <div className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-md shrink-0 ring-2 ring-white/60",
              `bg-gradient-to-br ${gradient}`
            )}>
              {initials}
            </div>

            <div className="flex-1 min-w-0 mt-0.5">
              <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-tight truncate">
                {name}
              </h2>
              {(lead.Account || lead.Campaign || lead.company) && (
                <p className="text-[12px] text-foreground/60 truncate mt-0.5">
                  {[lead.company, lead.Account, lead.Campaign].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {status && <StatusBadge label={status} />}
                {sentiment && (
                  <span className="text-[11px] text-foreground/60 font-medium">
                    {sentiment === "Positive" ? "😊" : sentiment === "Negative" ? "😞" : "😐"}
                    {" "}<span className="capitalize">{sentiment}</span>
                  </span>
                )}
                {lastActivity && (
                  <span className="text-[11px] text-foreground/50">{formatRelativeTime(lastActivity)}</span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 mt-0.5"
              title="Deselect"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Row 2: Pipeline funnel — below name */}
          <PipelineFunnel status={status} />

          {/* Row 3: Tags */}
          {leadTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {leadTags.map((t) => <TagPill key={t.name} tag={t} />)}
            </div>
          )}

          {/* Booked strip */}
          {isBooked && (
            <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 px-3 py-2 flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Call Booked — North Star KPI ✦
              </span>
              {lead.booked_call_date && (
                <span className="text-[11px] text-amber-600/80 dark:text-amber-500 ml-auto">
                  {formatRelativeTime(lead.booked_call_date)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Body — 3 cards in parallel, fixed height, no outer scroll ── */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 bg-slate-50/50 dark:bg-muted/10 min-h-0 overflow-hidden">

        {/* Card 1: Contact */}
        <ContactWidget lead={lead} />

        {/* Card 2: Lead Score */}
        {score > 0
          ? <ScoreWidget score={score} />
          : (
            <div className="rounded-xl border border-border/50 bg-card p-4 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Lead Score</p>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-black text-muted-foreground/25">—</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">Not scored yet</p>
                </div>
              </div>
            </div>
          )
        }

        {/* Card 3: Conversation — scrolls internally */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Conversation</p>
            </div>
            <span className="text-[10px] text-muted-foreground/50 truncate max-w-[80px]">
              {lead.phone || lead.Phone || ""}
            </span>
          </div>
          <ConversationWidget lead={lead} />
        </div>
      </div>
    </div>
  );
}

// ── Lead list card ─────────────────────────────────────────────────────────────
function LeadListCard({
  lead,
  isActive,
  onClick,
  leadTags,
}: {
  lead: Record<string, any>;
  isActive: boolean;
  onClick: () => void;
  leadTags: { name: string; color: string }[];
}) {
  const name = getFullName(lead);
  const initials = getInitials(name);
  const status = getStatus(lead);
  const score = getScore(lead);
  const subtitle = getSubtitle(lead);
  const gradient = getAvatarGradient(name);
  const lastActivity = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-border/20 transition-all duration-150 group/card",
        isActive
          ? "bg-primary/10 dark:bg-primary/15 border-l-[3px] border-l-primary pl-[13px]"
          : "hover:bg-stone-200/70 dark:hover:bg-white/5 border-l-[3px] border-l-transparent"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0 text-white shadow-sm",
        `bg-gradient-to-br ${gradient}`
      )}>
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            "text-[13px] font-semibold truncate leading-tight",
            isActive ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"
          )}>
            {name}
          </span>
          {score > 0 && (
            <span className={cn(
              "text-[10px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md",
              score >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : score >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {score}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate mb-1.5 leading-tight">{subtitle}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {status && <StatusDot label={status} />}
            {leadTags.slice(0, 1).map((t) => <TagPill key={t.name} tag={t} />)}
          </div>
          {lastActivity && (
            <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
              {formatRelativeTime(lastActivity)}
            </span>
          )}
        </div>
      </div>

      {/* Bridge arrow — shown on active item */}
      {isActive && (
        <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400/60 dark:text-indigo-500/50 shrink-0" />
      )}
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 border-b border-border/20 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-9 w-9 rounded-xl bg-muted/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted/60 rounded-full w-2/3" />
            <div className="h-2.5 bg-muted/40 rounded-full w-1/2" />
            <div className="h-2 bg-muted/30 rounded-full w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function LeadsCardView({
  leads,
  loading,
  selectedLead,
  onSelectLead,
  onClose,
  leadTagsInfo,
}: LeadsCardViewProps) {
  const [listSearch, setListSearch] = useState("");

  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return leads;
    const q = listSearch.toLowerCase();
    return leads.filter(
      (l) =>
        String(l.full_name || "").toLowerCase().includes(q) ||
        String(l.first_name || "").toLowerCase().includes(q) ||
        String(l.last_name || "").toLowerCase().includes(q) ||
        String(l.email || "").toLowerCase().includes(q) ||
        String(l.phone || "").toLowerCase().includes(q)
    );
  }, [leads, listSearch]);

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden gap-3">

      {/* ── LEFT: Lead List ── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col rounded-xl bg-stone-100 dark:bg-stone-900/60 overflow-hidden shadow-sm">

        {/* Panel header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200/80 dark:border-stone-700/60 shrink-0 bg-stone-100 dark:bg-stone-900/60">
          <div>
            <h2 className="text-[13px] font-bold text-foreground leading-tight">My Leads</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {leads.length} record{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40">
            Active
          </span>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-stone-200/80 dark:border-stone-700/60 shrink-0 bg-stone-100 dark:bg-stone-900/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400/50 placeholder:text-muted-foreground/50 transition-all"
            />
            {listSearch && (
              <button
                onClick={() => setListSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ListSkeleton />
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                {listSearch ? "No leads match your search" : "No leads found"}
              </p>
            </div>
          ) : (
            filteredList.map((lead) => {
              const id = getLeadId(lead);
              const selectedId = selectedLead ? getLeadId(selectedLead) : null;
              return (
                <LeadListCard
                  key={id}
                  lead={lead}
                  isActive={selectedId === id}
                  onClick={() => onSelectLead(lead)}
                  leadTags={leadTagsInfo.get(id) || []}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl bg-background shadow-sm overflow-hidden">
        {selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
          />
        ) : (
          <EmptyDetailState leadsCount={leads.length} />
        )}
      </div>
    </div>
  );
}
