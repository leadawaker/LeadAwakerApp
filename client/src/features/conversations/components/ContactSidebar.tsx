import { useEffect, useState } from "react";
import { Link } from "wouter";
import { User, Phone, Mail, Tag, Target, TrendingUp, Calendar } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { SkeletonContactPanel } from "@/components/ui/skeleton";
import type { Thread, Lead } from "../hooks/useConversationsData";

function initialsFor(lead: Lead) {
  const a = (lead.first_name ?? "").slice(0, 1);
  const b = (lead.last_name ?? "").slice(0, 1);
  return `${a}${b}`.toUpperCase() || "?";
}

interface TagData {
  id: number;
  name: string;
  color: string;
  category?: string;
}

interface LeadTagRow {
  id: number;
  leadsId?: number;
  tagsId?: number;
  [key: string]: any;
}

// Map tag colors (DB uses named colors or hex)
function tagColorClass(color: string): string {
  const map: Record<string, string> = {
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/30",
    blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/30",
    green: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/30",
    red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/30",
    orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/30",
    purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/30",
    gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/40",
  };
  return map[color?.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

// Compute a simple lead score (0-100) from available lead fields
function computeLeadScore(lead: Lead): number {
  let score = 0;

  // Conversion status (+40 max)
  const status = (lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus ?? "New").toLowerCase();
  if (status === "booked") score += 40;
  else if (status === "qualified") score += 30;
  else if (status === "interested") score += 25;
  else if (status === "responded") score += 20;
  else if (status === "contacted") score += 10;
  else if (status === "new") score += 5;

  // Messages received (+20 max)
  const received = Number(lead.message_count_received ?? 0);
  score += Math.min(20, received * 5);

  // Bump stage progress (+20 max)
  const bumpStage = Number(lead.current_bump_stage ?? 0);
  score += Math.min(20, bumpStage * 7);

  // Has booked date (+10)
  if (lead.booked_call_date ?? lead.bookedCallDate) score += 10;

  // Manual takeover (agent engaged) (+5)
  if (lead.manual_takeover ?? lead.manualTakeover) score += 5;

  // Not opted out (+5)
  if (!(lead.opted_out ?? lead.optedOut)) score += 5;

  return Math.min(100, score);
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-gray-400 dark:bg-gray-600";
}

// Pipeline stage label from conversion_status and bump stage
function getPipelineStage(lead: Lead): { label: string; description: string; color: string } {
  const status = (lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus ?? "New");
  const bumpStage = Number(lead.current_bump_stage ?? 0);

  if (status === "Booked") {
    return { label: "Booked", description: "Call booked", color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/30" };
  }
  if (status === "Qualified") {
    return { label: "Qualified", description: "Lead qualified", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/30" };
  }
  if (status === "Interested") {
    return { label: "Interested", description: "Lead interested", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/30" };
  }
  if (status === "Responded") {
    return { label: "Responded", description: "Lead replied", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/30" };
  }
  // Fall back to bump stage
  if (bumpStage >= 3) return { label: `Bump ${bumpStage}`, description: "All bumps sent", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/30" };
  if (bumpStage > 0) return { label: `Bump ${bumpStage}`, description: `Bump ${bumpStage} sent`, color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/30" };
  return { label: status || "New", description: "Initial contact", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/40" };
}

// Hook: fetch real tags for a lead via /api/leads/:id/tags + /api/tags
function useLeadTags(leadId: number | null) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setTags([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const fetchTags = async () => {
      try {
        // Fetch junction rows and all tags in parallel
        const [junctionRes, allTagsRes] = await Promise.all([
          apiFetch(`/api/leads/${leadId}/tags`),
          apiFetch("/api/tags"),
        ]);

        if (!junctionRes.ok || !allTagsRes.ok) {
          if (!cancelled) setTags([]);
          return;
        }

        const junctionRows: LeadTagRow[] = await junctionRes.json();
        const allTags: TagData[] = await allTagsRes.json();

        // Build a map from tag id to tag object
        const tagMap = new Map<number, TagData>();
        for (const t of allTags) {
          if (t.id) tagMap.set(t.id, t);
        }

        // Resolve tags from junction rows
        const resolved: TagData[] = [];
        for (const row of junctionRows) {
          const tagId = row.tagsId ?? row.tags_id ?? row.tagId ?? row.tag_id;
          if (tagId && tagMap.has(tagId)) {
            const tag = tagMap.get(tagId)!;
            if (tag.name) resolved.push(tag);
          }
        }

        if (!cancelled) setTags(resolved);
      } catch {
        if (!cancelled) setTags([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTags();
    return () => { cancelled = true; };
  }, [leadId]);

  return { tags, loading };
}

interface ContactSidebarProps {
  selected: Thread | null;
  loading?: boolean;
  className?: string;
}

export function ContactSidebar({ selected, loading = false, className }: ContactSidebarProps) {
  const leadId = selected?.lead?.id ?? null;
  const { tags: leadTags, loading: tagsLoading } = useLeadTags(leadId);

  const lead = selected?.lead ?? null;
  const score = lead ? computeLeadScore(lead) : 0;
  const stage = lead ? getPipelineStage(lead) : null;

  return (
    <section
      className={className ?? "hidden xl:flex rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex-col h-full"}
      data-testid="panel-contact"
    >
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="text-sm font-semibold">Lead Context</div>
        <div className="text-xs text-muted-foreground">Score, stage &amp; tags</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && !selected ? (
          // Loading skeleton — shown while initial data loads
          <SkeletonContactPanel data-testid="skeleton-contact-panel" />
        ) : !selected ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Select a conversation to see lead context.
          </div>
        ) : (
          <>
            {/* Lead Identity */}
            <div className="flex items-start gap-3" data-testid="contact-identity">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-extrabold grid place-items-center border border-primary/20 shrink-0">
                {initialsFor(selected.lead)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {selected.lead.full_name ||
                    `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim() ||
                    "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected.lead.Source ?? selected.lead.source ?? "—"}
                </div>
              </div>
            </div>

            {/* Lead Score */}
            <div
              className="rounded-xl border border-border bg-muted/10 p-3"
              data-testid="lead-score"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                  <TrendingUp className="h-3 w-3" />
                  Lead Score
                </div>
                <span className={`text-lg font-extrabold tabular-nums ${scoreColor(score)}`}>
                  {score}
                  <span className="text-xs font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${scoreBarColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Pipeline Stage */}
            {stage && (
              <div
                className="rounded-xl border border-border bg-muted/10 p-3"
                data-testid="pipeline-stage"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
                  <Target className="h-3 w-3" />
                  Pipeline Stage
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${stage.color}`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{stage.description}</span>
                </div>
                {/* Bump stage progress dots */}
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        Number(selected.lead.current_bump_stage ?? 0) >= n
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                      title={`Bump ${n}`}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Bumps sent: {Number(selected.lead.current_bump_stage ?? 0)} / 3
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="space-y-2" data-testid="contact-info">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                <User className="h-3 w-3" />
                Contact Info
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Phone</div>
                    <div className="text-sm font-medium">{selected.lead.phone ?? "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Email</div>
                    <div className="text-sm font-medium break-words">
                      {selected.lead.Email ?? selected.lead.email ?? "—"}
                    </div>
                  </div>
                </div>
                {(selected.lead.booked_call_date ?? selected.lead.bookedCallDate) && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-muted-foreground">Booked Call</div>
                      <div className="text-sm font-medium">
                        {new Date(
                          selected.lead.booked_call_date ?? selected.lead.bookedCallDate
                        ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div data-testid="contact-tags">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
                <Tag className="h-3 w-3" />
                Tags
              </div>
              {tagsLoading ? (
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 w-16 rounded-full bg-muted animate-pulse" />
                  ))}
                </div>
              ) : leadTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {leadTags.map((t) => (
                    <span
                      key={t.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tagColorClass(t.color)}`}
                      title={t.category ? `${t.category}: ${t.name}` : t.name}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No tags assigned.</div>
              )}
            </div>

            {/* View full contact link */}
            <div className="pt-2">
              <Link
                href={`/agency/contacts/${selected.lead.id}`}
                className="block text-center h-10 leading-[40px] rounded-xl border border-border bg-background hover:bg-muted/20 text-sm font-semibold transition-colors"
              >
                View full contact →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
