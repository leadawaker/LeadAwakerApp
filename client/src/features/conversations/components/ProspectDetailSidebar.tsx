import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, ChevronDown, Check, Loader2, Mail, Phone, Globe, Heart, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getProspectLogoUrl, getProspectAvatarColor } from "@/lib/avatarUtils";
import {
  PROSPECT_STATUS_HEX,
  PRIORITY_HEX,
  NICHE_COLORS,
  FALLBACK_NICHE_COLOR,
  formatRelativeTime,
  type ProspectRow,
} from "@/features/prospects/components/prospectTypes";
import { CompanyAuditSection } from "@/features/prospects/components/CompanyAuditSection";
import type { ProspectThread } from "../hooks/useProspectConversations";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface ProspectDetailSidebarProps {
  prospectId: number;
  thread: ProspectThread;
  onClose: () => void;
  className?: string;
}

type Tab = "info" | "messages" | "audit";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/[0.06] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, href, icon: Icon }: { label: string; value?: string | null; href?: string; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 min-w-0">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-brand-indigo hover:underline flex items-center gap-1 truncate"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="text-[12px] text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

function parseOffers(raw: string | null | undefined): Array<{ text: string; checked?: boolean }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseSavedMessages(raw: string | null | undefined): Array<{ title: string; text: string; saved?: boolean }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseAuditInsights(raw: unknown) {
  if (!raw) return null;
  if (typeof raw === "object") return raw as any;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

export function ProspectDetailSidebar({ prospectId, thread, onClose, className }: ProspectDetailSidebarProps) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [localNotes, setLocalNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const { data: prospect } = useQuery<ProspectRow>({
    queryKey: ["/api/prospects", prospectId],
    queryFn: () => fetch(`/api/prospects/${prospectId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!prospectId,
  });

  useEffect(() => {
    setLocalNotes(prospect?.notes ?? "");
    setNotesDirty(false);
  }, [prospect?.id ?? prospectId]);

  const handleNotesSave = async () => {
    if (!notesDirty) return;
    setNotesSaving(true);
    try {
      await fetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: localNotes }),
      });
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error("[ProspectDetailSidebar] Notes save failed:", err);
    } finally {
      setNotesSaving(false);
    }
  };

  const displayName = prospect?.company || thread.company || thread.name;
  const avatarColor = getProspectAvatarColor(thread.outreach_status);
  const logoUrl = getProspectLogoUrl(prospect?.website || thread.website || null, displayName);

  const statusColor = PROSPECT_STATUS_HEX[thread.outreach_status] ?? "#94A3B8";
  const priorityColor = PRIORITY_HEX[thread.priority] ?? "#9CA3AF";

  const nicheIndex = thread.niche
    ? Array.from(thread.niche).reduce((a, c) => a + c.charCodeAt(0), 0) % NICHE_COLORS.length
    : -1;
  const nicheColor = nicheIndex >= 0 ? NICHE_COLORS[nicheIndex] : FALLBACK_NICHE_COLOR;

  const channels = thread.channels ?? [];

  const offers = parseOffers(prospect?.offer_ideas as string | null);
  const checkedOffers = offers.filter((o) => o.checked);
  const savedMessages = parseSavedMessages(prospect?.generated_messages as string | null).filter((m) => m.saved);
  const auditInsights = parseAuditInsights((prospect as any)?.audit_insights);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "info", label: "Info" },
    { id: "messages", label: "Messages", badge: savedMessages.length || undefined },
    { id: "audit", label: "Audit" },
  ];

  const [enriching, setEnriching] = useState(false);
  const qc = useQueryClient();

  async function handleEnrich() {
    if (enriching) return;
    setEnriching(true);
    try {
      await apiFetch(`/api/prospects/${prospectId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "company" }),
      });
      qc.invalidateQueries({ queryKey: ["/api/prospects", prospectId] });
    } catch {
      // silent
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-col h-full bg-card rounded-xl border border-black/[0.06] overflow-hidden shadow-sm">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-black/[0.06]">
          <div className="flex items-start gap-3">
            <EntityAvatar
              name={displayName}
              photoUrl={logoUrl ?? undefined}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={40}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground leading-tight truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {thread.niche && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: nicheColor.bg, color: nicheColor.text }}
                  >
                    {thread.niche}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
                  <span className="text-[10px] text-muted-foreground">{thread.outreach_status}</span>
                </div>
                {thread.priority && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: `${priorityColor}18`, color: priorityColor }}
                  >
                    {thread.priority}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              title="Hide panel"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-brand-indigo text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {tab.label}
                {tab.badge ? (
                  <span className={cn(
                    "text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center leading-none",
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-brand-indigo/10 text-brand-indigo"
                  )}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* ── INFO TAB ── */}
          {activeTab === "info" && (
            <>
              <Section title="Contact">
                <InfoRow label="Name" value={prospect?.contact_name || thread.contact_name} />
                <InfoRow label="Role" value={prospect?.contact_role} />
                <InfoRow label="Email" value={prospect?.contact_email || thread.contact_email} href={prospect?.contact_email ? `mailto:${prospect.contact_email}` : undefined} icon={Mail} />
                <InfoRow label="Phone" value={prospect?.contact_phone || thread.contact_phone} href={prospect?.contact_phone ? `tel:${prospect.contact_phone}` : undefined} icon={Phone} />
                <InfoRow label="LinkedIn" value={prospect?.contact_linkedin} href={prospect?.contact_linkedin || undefined} icon={ExternalLink} />
                {prospect?.contact2_name && (
                  <>
                    <div className="pt-1 border-t border-black/[0.06]">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Second contact</p>
                    </div>
                    <InfoRow label="Name" value={prospect.contact2_name} />
                    <InfoRow label="Role" value={prospect.contact2_role} />
                    <InfoRow label="Email" value={prospect.contact2_email} href={prospect.contact2_email ? `mailto:${prospect.contact2_email}` : undefined} icon={Mail} />
                    <InfoRow label="Phone" value={prospect.contact2_phone} href={prospect.contact2_phone ? `tel:${prospect.contact2_phone}` : undefined} icon={Phone} />
                  </>
                )}
              </Section>

              <Section title="Company">
                <InfoRow label="Website" value={prospect?.website || thread.website} href={prospect?.website || thread.website || undefined} icon={Globe} />
                <InfoRow label="LinkedIn" value={prospect?.company_linkedin} href={prospect?.company_linkedin || undefined} icon={ExternalLink} />
                {(prospect?.city || prospect?.country) && (
                  <InfoRow label="Location" value={[prospect.city, prospect.country].filter(Boolean).join(", ")} />
                )}
                <InfoRow label="Source" value={prospect?.source} />
              </Section>

              <Section title="Outreach">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
                  <span className="text-[12px] text-foreground">{thread.outreach_status}</span>
                </div>
                {thread.priority && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Priority</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: `${priorityColor}18`, color: priorityColor }}
                    >
                      {thread.priority}
                    </span>
                  </div>
                )}
                <InfoRow label="Messages sent" value={thread.total_messages ? String(thread.total_messages) : null} />
                <InfoRow label="Last message" value={formatRelativeTime(thread.last_message_at)} />
                {channels.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {channels.map((ch) => (
                      <span key={ch} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
              </Section>

              {checkedOffers.length > 0 && (
                <Section title="Selected offers">
                  <div className="space-y-1.5">
                    {checkedOffers.map((offer, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-[12px] text-foreground leading-snug">{offer.text}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Notes">
                <div className="relative">
                  <textarea
                    value={localNotes}
                    onChange={(e) => { setLocalNotes(e.target.value); setNotesDirty(true); setNotesSaved(false); }}
                    onBlur={handleNotesSave}
                    rows={4}
                    placeholder="Add notes…"
                    className="w-full text-[12px] bg-muted/40 border border-black/[0.08] rounded-md px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-indigo/40 text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="absolute bottom-2 right-2 h-4 flex items-center">
                    {notesSaving && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
                    {notesSaved && !notesSaving && <Check className="h-3 w-3 text-emerald-500" />}
                  </div>
                </div>
              </Section>
            </>
          )}

          {/* ── MESSAGES TAB ── */}
          {activeTab === "messages" && (
            <div className="p-4 space-y-2.5">
              {savedMessages.length === 0 ? (
                <div className="py-8 text-center">
                  <Heart className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[12px] text-muted-foreground/60">No saved messages yet.</p>
                  <p className="text-[11px] text-muted-foreground/40 mt-1">Heart a message in the prospect profile to save it here.</p>
                </div>
              ) : (
                savedMessages.map((msg, i) => (
                  <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Heart className="h-3 w-3 text-emerald-500 fill-emerald-500 shrink-0" />
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide truncate">{msg.title}</p>
                    </div>
                    <p className="text-[12px] text-foreground/80 leading-snug whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── AUDIT TAB ── */}
          {activeTab === "audit" && (
            <div className="p-4 space-y-3">
              <button
                type="button"
                onClick={handleEnrich}
                disabled={enriching}
                className="w-full h-8 flex items-center justify-center gap-1.5 rounded-md border border-black/[0.125] text-[12px] font-medium text-foreground/70 hover:text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {enriching ? "Enriching…" : "Enrich company"}
              </button>
              <CompanyAuditSection insights={auditInsights} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-black/[0.06]">
          <button
            type="button"
            onClick={() => navigate(`/agency/prospects?id=${prospectId}`)}
            className="w-full h-8 rounded-md border border-black/[0.125] text-[12px] font-medium text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            View full profile
          </button>
        </div>
      </div>
    </div>
  );
}
