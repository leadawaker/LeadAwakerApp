import { useState, useCallback } from "react";
import {
  Building2,
  Phone,
  Bot,
  Globe,
  Clock,
  FileText,
  Pencil,
  CheckCircle2,
  PauseCircle,
  Ban,
  HelpCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Mail,
  ExternalLink,
  PlayCircle,
  PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountRow } from "./AccountDetailsDialog";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarGradient(status: string): string {
  switch (status) {
    case "Active":    return "from-emerald-500 to-teal-600";
    case "Trial":     return "from-amber-500 to-orange-600";
    case "Suspended": return "from-rose-500 to-red-600";
    case "Inactive":  return "from-slate-400 to-zinc-500";
    default:          return "from-indigo-500 to-violet-600";
  }
}

function getStatusBadgeCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    case "Trial":     return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    case "Suspended": return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700";
    case "Inactive":  return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
    default:          return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
  }
}

function getStatusDotCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Trial":     return "bg-amber-500";
    case "Suspended": return "bg-rose-500";
    case "Inactive":  return "bg-slate-400";
    default:          return "bg-indigo-400";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Active":    return <CheckCircle2 className="w-3 h-3" />;
    case "Trial":     return <Clock className="w-3 h-3" />;
    case "Suspended": return <Ban className="w-3 h-3" />;
    case "Inactive":  return <PauseCircle className="w-3 h-3" />;
    default:          return <HelpCircle className="w-3 h-3" />;
  }
}

// ── Account status row ────────────────────────────────────────────────────────

const ACCOUNT_STATUSES = ["Trial", "Active", "Inactive", "Suspended"] as const;

function AccountStatusRow({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {ACCOUNT_STATUSES.map((s, i) => {
        const isCurrent = s === status;
        const isPast = ACCOUNT_STATUSES.indexOf(s as typeof ACCOUNT_STATUSES[number]) <
                       ACCOUNT_STATUSES.indexOf(status as typeof ACCOUNT_STATUSES[number]);
        return (
          <div key={s} className="flex items-center gap-0 shrink-0">
            {i > 0 && (
              <div className={cn("h-px w-5 shrink-0",
                isPast || isCurrent ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border/50"
              )} />
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
              isCurrent
                ? cn("border", getStatusBadgeCls(s))
                : isPast
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground/50"
            )}>
              {isPast    && <Check className="h-2.5 w-2.5 shrink-0" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />}
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseServiceCategories(val: string | null | undefined): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatTimeDisplay(val: string | null | undefined): string {
  if (!val) return "—";
  const parts = val.split(":");
  if (parts.length < 2) return val;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return val;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h).padStart(2, "0")}:${minutes} ${ampm}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WidgetCard({ title, icon, children, fullWidth = false, testId }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn("bg-card border border-border rounded-xl shadow-sm overflow-hidden", fullWidth && "col-span-2")}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[12px] text-foreground text-right break-words max-w-[65%]", mono && "font-mono text-[11px]")}>
        {value ?? <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  );
}

function CopyButton({ value, masked = false }: { value: string; masked?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SecretRow({ label, value }: { label: string; value: string | null | undefined }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <InfoRow label={label} value={null} />;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn("text-[11px] font-mono text-foreground truncate max-w-[140px]", !revealed && "tracking-widest")}>
          {revealed ? value : "••••••••••••"}
        </span>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function AccountDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Building2 className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/70">Select an account</p>
        <p className="text-xs text-muted-foreground mt-1">Click any account on the left to see its details</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface AccountDetailViewProps {
  account: AccountRow;
  onEdit: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
}

export function AccountDetailView({ account, onEdit, onToggleStatus }: AccountDetailViewProps) {
  const status = String(account.status || "Unknown");
  const avatarGradient = getAvatarGradient(status);
  const badgeCls = getStatusBadgeCls(status);
  const dotCls = getStatusDotCls(status);
  const accountId = account.Id ?? account.id ?? 0;

  const isActive = status === "Active";
  const canToggle = status === "Active" || status === "Inactive";

  const initials = (account.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const serviceCategories = parseServiceCategories(account.service_categories);

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="account-detail-view">

      {/* ── HEADER — D365 soft mint gradient ───────────────────────── */}
      <div className="shrink-0 relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50/40 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(167,243,208,0.35)_0%,_transparent_65%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent dark:via-emerald-800/30" />

        <div className="relative px-4 pt-4 pb-3 space-y-2.5">

          {/* Row 1: Avatar + Identity + Actions */}
          <div className="flex items-start gap-3.5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-md shrink-0 ring-2 ring-white/60",
              `bg-gradient-to-br ${avatarGradient}`
            )}>
              {initials || <Building2 className="w-6 h-6" />}
            </div>

            <div className="flex-1 min-w-0 mt-0.5">
              <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-tight truncate" data-testid="account-detail-name">
                {account.name || "Unnamed Account"}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", badgeCls)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", dotCls)} />
                  {getStatusIcon(status)}
                  {status}
                </span>
                {account.type && (
                  <span className="text-[12px] text-foreground/60">{account.type}</span>
                )}
                {account.business_niche && (
                  <span className="text-[11px] text-foreground/50 truncate">{account.business_niche}</span>
                )}
                <span className="text-[11px] text-foreground/40">#{accountId}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={() => onEdit(account)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                data-testid="account-detail-edit-btn"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              {canToggle && (
                <button
                  onClick={() => onToggleStatus(account)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                  data-testid="account-detail-toggle-btn"
                >
                  {isActive
                    ? <><PowerOff className="w-3.5 h-3.5" />Deactivate</>
                    : <><PlayCircle className="w-3.5 h-3.5" />Activate</>
                  }
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Account status indicator */}
          <AccountStatusRow status={status} />

        </div>
      </div>

      {/* ── BODY — 3 cards in parallel, fixed height, no outer scroll ── */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 bg-slate-50/50 dark:bg-muted/10 min-h-0 overflow-hidden">

        {/* Card 1: Overview — Basic info + Contact */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-basic">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Overview</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0">
            <InfoRow label="Type" value={account.type} />
            <InfoRow label="Niche" value={account.business_niche} />
            {/* Contact sub-section */}
            <div className="pt-3 mt-1 border-t border-border/30 space-y-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Email</span>
                <div className="flex items-center gap-1 min-w-0">
                  {account.owner_email
                    ? <>
                        <span className="text-[12px] text-foreground truncate max-w-[120px]">{account.owner_email}</span>
                        <a href={`mailto:${account.owner_email}`} className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted transition-colors">
                          <Mail className="h-3 w-3" />
                        </a>
                      </>
                    : <span className="text-[12px] text-muted-foreground italic">—</span>
                  }
                </div>
              </div>
              <InfoRow label="Phone" value={account.phone} />
              <div className="flex items-start justify-between gap-3 py-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Website</span>
                <div className="flex items-center gap-1 min-w-0">
                  {account.website
                    ? <>
                        <span className="text-[12px] text-foreground truncate max-w-[100px]">{account.website}</span>
                        <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted transition-colors">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    : <span className="text-[12px] text-muted-foreground italic">—</span>
                  }
                </div>
              </div>
            </div>
            {/* Notes / description */}
            {(account.business_description || account.notes || serviceCategories.length > 0) && (
              <div className="pt-3 mt-1 border-t border-border/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes</span>
                </div>
                {account.business_description && (
                  <p className="text-[12px] text-foreground leading-relaxed mb-2 line-clamp-3">{account.business_description}</p>
                )}
                {serviceCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {serviceCategories.map((cat, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {account.notes && !account.business_description && (
                  <p className="text-[12px] text-foreground leading-relaxed line-clamp-4">{account.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Schedule & AI */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-ai">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI & Schedule</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0">
            <InfoRow label="AI Name" value={account.default_ai_name} />
            <InfoRow label="AI Role" value={account.default_ai_role} />
            <InfoRow label="AI Style" value={account.default_ai_style} />
            <InfoRow label="Typo Frequency" value={account.default_typo_frequency} />
            <InfoRow label="Opt-out Keyword" value={account.opt_out_keyword} />
            <InfoRow label="Terminology" value={account.preferred_terminology} />
            {/* Schedule sub-section */}
            <div className="pt-3 mt-1 border-t border-border/30 space-y-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</span>
              </div>
              <InfoRow label="Timezone" value={account.timezone} />
              <InfoRow label="Hours Open" value={formatTimeDisplay(account.business_hours_start)} />
              <InfoRow label="Hours Close" value={formatTimeDisplay(account.business_hours_end)} />
              <InfoRow label="Max Daily Sends" value={account.max_daily_sends != null ? String(account.max_daily_sends) : null} />
            </div>
          </div>
        </div>

        {/* Card 3: Twilio Integration */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-twilio">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Twilio</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0">
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40">
              <span className="text-[11px] text-muted-foreground shrink-0">Account SID</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_account_sid || "—"}</span>
                {account.twilio_account_sid && <CopyButton value={String(account.twilio_account_sid)} />}
              </div>
            </div>
            <div className="py-1.5 border-b border-border/40">
              <SecretRow label="Auth Token" value={account.twilio_auth_token} />
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40">
              <span className="text-[11px] text-muted-foreground shrink-0">Service SID</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_messaging_service_sid || "—"}</span>
                {account.twilio_messaging_service_sid && <CopyButton value={String(account.twilio_messaging_service_sid)} />}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40">
              <span className="text-[11px] text-muted-foreground shrink-0">From Number</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_default_from_number || "—"}</span>
                {account.twilio_default_from_number && <CopyButton value={String(account.twilio_default_from_number)} />}
              </div>
            </div>
            {account.webhook_url && (
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0">Webhook</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.webhook_url}</span>
                  <CopyButton value={String(account.webhook_url)} />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
