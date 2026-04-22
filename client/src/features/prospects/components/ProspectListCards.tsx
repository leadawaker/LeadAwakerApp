import { useState, useRef } from "react";
import { Globe, Mail, Phone, Linkedin, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ProspectAvatar } from "./ProspectAvatar";
import { getInitials } from "@/lib/avatarUtils";
import {
  ProspectRow,
  PROSPECT_STATUS_HEX,
  PRIORITY_HEX,
  SIGNAL_FILLED,
  SIGNAL_COLOR,
  NICHE_COLORS,
  FALLBACK_NICHE_COLOR,
  formatRelativeTime,
  getProspectId,
} from "./prospectTypes";
import { OUTREACH_HEX, OUTREACH_LABELS, type OutreachStatus } from "./OutreachPipelineView";

// ── Signal bars ───────────────────────────────────────────────────────────────

export function SignalBars({ priority }: { priority: string }) {
  const filled = SIGNAL_FILLED[priority] ?? 0;
  const color = SIGNAL_COLOR[priority] || "#9CA3AF";
  const label = priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "No priority";
  return (
    <div className="flex items-end gap-[2px]" title={label} aria-label={`Priority: ${label}`}>
      {[6, 10, 14].map((h, i) => (
        <div
          key={i}
          className="w-[4px] rounded-[1px]"
          style={{ height: `${h}px`, backgroundColor: i < filled ? color : "#D1D5DB" }}
        />
      ))}
    </div>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

export function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky -top-[3px] z-20 bg-muted px-3 pt-[15px] pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">&ndash;</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

// ── List skeleton ─────────────────────────────────────────────────────────────

export function ListSkeleton({ compact = false }: { compact?: boolean } = {}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-0 py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center py-1 mx-1 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Filter accordion ──────────────────────────────────────────────────────────

export function FilterAccordionSection({
  label,
  activeCount,
  defaultOpen = false,
  children,
}: {
  label: string;
  activeCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);
  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-colors duration-150"
      >
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />
        }
        <span className="flex-1 text-left font-medium">{label}</span>
        {activeCount > 0 && (
          <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {activeCount}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

// ── Prospect list card ────────────────────────────────────────────────────────

export function ProspectListCard({
  prospect,
  isActive,
  onClick,
  nicheColor,
  hideAvatar = false,
}: {
  prospect: ProspectRow;
  isActive: boolean;
  onClick: () => void;
  nicheColor: { hex: string; bg: string; text: string };
  hideAvatar?: boolean;
}) {
  const { t } = useTranslation("prospects");
  const name = String(prospect.name || prospect.company || "");
  const company = String(prospect.company || "");
  const niche = String(prospect.niche || "");
  const status = String(prospect.status || "");
  const priority = String(prospect.priority || "");
  const statusHex = PROSPECT_STATUS_HEX[status] || "#94A3B8";
  const lastUpdated = prospect.updated_at || prospect.created_at;
  const website = String(prospect.website || "");
  const phone = String(prospect.phone || "");
  const email = String(prospect.email || "");
  const linkedin = String(prospect.linkedin || "");
  const source = String(prospect.source || "");

  const hasHoverContent = !!(website || phone || email || linkedin || source);
  const outreachStatus = String(prospect.outreach_status || "new") as OutreachStatus;
  const followUpDate = prospect.next_follow_up_date ? new Date(prospect.next_follow_up_date as string) : null;
  const isOverdue = followUpDate ? followUpDate.getTime() < Date.now() : false;

  return (
    <div
      className={cn(
        "group rounded-xl cursor-pointer",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid="prospect-mobile-card"
    >
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-1.5">
        <div className="flex items-start gap-2.5">
          {!hideAvatar && (
            <ProspectAvatar
              name={name}
              website={prospect.website}
              companyLogoUrl={prospect.company_logo_url}
              outreachStatus={outreachStatus}
            />
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-1.5">
              <p className="text-[18px] font-semibold font-heading leading-tight truncate text-foreground">
                {name}
              </p>
              <div className="shrink-0 flex items-center gap-1.5 mt-1">
                {isOverdue && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-red-500">Overdue</span>
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground/45 tabular-nums whitespace-nowrap">
                    {formatRelativeTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-1 mt-[3px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 bg-white/40 dark:bg-white/[0.08]"
                  style={{ color: OUTREACH_HEX[outreachStatus] || "#6B7280" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: OUTREACH_HEX[outreachStatus] || "#6B7280" }}
                  />
                  {OUTREACH_LABELS[outreachStatus] || outreachStatus.replace(/_/g, " ")}
                </span>
                {getProspectId(prospect) > 0 && (
                  <span className="text-[10px] font-semibold text-foreground/35 shrink-0">#{getProspectId(prospect)}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {niche && (
                  <span
                    className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap bg-white/40 dark:bg-white/[0.08]"
                    style={{ color: nicheColor.hex }}
                  >
                    {niche}
                  </span>
                )}
                <SignalBars priority={priority} />
              </div>
            </div>
          </div>
        </div>

        {prospect.last_contacted_at && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
            <span>
              {prospect.contact_method === "email" ? "Emailed" : "Contacted"}{" "}
              {formatRelativeTime(prospect.last_contacted_at)}
            </span>
            {(prospect.follow_up_count ?? 0) > 1 && (
              <>
                <span className="text-muted-foreground/25">·</span>
                <span>{prospect.follow_up_count} follow-ups</span>
              </>
            )}
          </div>
        )}

        {hasHoverContent && (
          <div className="overflow-hidden max-h-0 opacity-0 group-hover:max-h-[80px] group-hover:opacity-100 transition-[max-height,opacity] duration-200 ease-out">
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-black/[0.06]">
              {(website || source) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {website && (
                    <span className="flex items-center gap-1 text-[10px] text-foreground/40 truncate">
                      <Globe className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{website}</span>
                    </span>
                  )}
                  {website && source && <span className="text-[10px] text-foreground/25 shrink-0">&middot;</span>}
                  {source && <span className="text-[10px] text-foreground/40 truncate">{source}</span>}
                </div>
              )}
              {(email || phone || linkedin) && (
                <div className="flex items-center gap-3 min-w-0">
                  {email && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{email}</span>
                    </span>
                  )}
                  {phone && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      {phone}
                    </span>
                  )}
                  {linkedin && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 truncate min-w-0">
                      <Linkedin className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                      <span className="truncate">{linkedin}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Progress ring (activity-ring style, colored by outreach status) ──────────

const PROGRESSION_STAGES: OutreachStatus[] = [
  "new", "contacted", "responded", "call_booked",
  "demo_given", "proposal_sent", "negotiating", "deal_closed",
];

function OutreachProgressRing({
  status,
  size,
  strokeWidth = 2.5,
}: {
  status: OutreachStatus;
  size: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const hex = OUTREACH_HEX[status] || "#6B7280";

  const isLost = status === "lost";
  const progressIdx = PROGRESSION_STAGES.indexOf(status);
  // new = 0/7 (empty), deal_closed = 7/7 (full). Lost = full ring in red.
  const lastIdx = PROGRESSION_STAGES.length - 1;
  const ratio = isLost ? 1 : progressIdx >= 0 ? progressIdx / lastIdx : 0;
  const arcLen = circumference * ratio;
  const gapLen = circumference - arcLen;

  return (
    <svg
      className="absolute inset-0 pointer-events-none -rotate-90"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={hex}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${gapLen}`}
        style={{ transition: "stroke-dasharray 300ms ease-out, stroke 200ms ease-out" }}
      />
    </svg>
  );
}

// ── Compact prospect card (avatar-only for narrow left panel) ────────────────

export function CompactProspectCard({
  prospect,
  isActive,
  onClick,
  nicheColor,
  onHover,
  onHoverEnd,
}: {
  prospect: ProspectRow;
  isActive: boolean;
  onClick: () => void;
  nicheColor: { hex: string; bg: string; text: string };
  onHover: (prospect: ProspectRow, rect: DOMRect) => void;
  onHoverEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const name = String(prospect.name || prospect.company || "");
  const outreachStatus = String(prospect.outreach_status || "new") as OutreachStatus;

  const ringSize = 48;
  const avatarSize = 40;

  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-1 mx-1 cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => {
        if (ref.current) onHover(prospect, ref.current.getBoundingClientRect());
      }}
      onMouseLeave={onHoverEnd}
    >
      <div
        className="relative flex items-center justify-center text-foreground"
        style={{ width: ringSize, height: ringSize }}
      >
        <OutreachProgressRing status={outreachStatus} size={ringSize} />
        <div
          className="rounded-full"
          style={isActive ? { boxShadow: "0 0 0 3px #ffffff, 0 0 0 4px rgba(0,0,0,0.9)" } : undefined}
        >
          <ProspectAvatar
            name={name}
            website={prospect.website}
            companyLogoUrl={prospect.company_logo_url}
            outreachStatus={outreachStatus}
            size={avatarSize}
          />
        </div>
      </div>
    </div>
  );
}

// ── Compact group divider ────────────────────────────────────────────────────

export function CompactGroupDivider({ label, count }: { label?: string; count?: number }) {
  const title = label
    ? count !== undefined
      ? `${label} (${count})`
      : label
    : undefined;
  return (
    <div
      className="group/divider relative h-px bg-foreground/10 mx-2.5 my-1.5 cursor-default"
      title={title}
    >
      {label && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/divider:opacity-100 transition-opacity duration-150 bg-foreground text-background text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
          {label}
          {count !== undefined && <span className="opacity-60 tabular-nums ml-1">{count}</span>}
        </span>
      )}
    </div>
  );
}
