// Interaction + tag/status timeline for the Lead detail panel. Body moved
// verbatim from LeadDetailPanel.tsx (structural split — no behaviour change).
import { useTranslation } from "react-i18next";
import { MessageSquare, Activity, Tag, Bot, User, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./atoms";
import { fmtDateTime } from "./format";
import type { Interaction } from "./types";

interface LeadInteractionTimelineProps {
  interactions: Interaction[];
  loadingInteractions: boolean;
  tagEvents: any[];
}

export function LeadInteractionTimeline({
  interactions,
  loadingInteractions,
  tagEvents,
}: LeadInteractionTimelineProps) {
  const { t } = useTranslation("leads");
  return (
    <>
          <SectionTitle
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            title={interactions.length > 0 ? t("timeline.titleWithCount", { count: interactions.length }) : t("timeline.title")}
          />
          <div
            data-testid="lead-detail-panel-interactions"
          >
            {loadingInteractions ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5">
                    <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                      <div className="h-3.5 w-3/5 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">{t("timeline.noInteractions")}</p>
                <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
                  {t("timeline.noInteractionsHint")}
                </p>
              </div>
            ) : (
              <div
                className="max-h-[320px] overflow-y-auto space-y-1"
                data-testid="interaction-timeline"
              >
                {(() => {
                  // Status names that get a colored status chip instead of a tag chip
                  const STATUS_TAG_NAMES = new Set(["Contacted","Responded","Multiple Responses","Qualified","Booked","Lost","DND","Opted Out","DNC"]);
                  const STATUS_HEX: Record<string, string> = { Contacted:"#818CF8", Responded:"#3ACBDF", "Multiple Responses":"#31D35C", Qualified:"#AED62E", Booked:"#22C55E", Lost:"#DC2626", DND:"#722F37", "Opted Out":"#6B7280", DNC:"#6B7280" };
                  // Case-insensitive lookup
                  const _sLower = new Map<string, string>();
                  Array.from(STATUS_TAG_NAMES).forEach(s => _sLower.set(s.toLowerCase(), s));
                  const findCanonical = (n: string) => STATUS_TAG_NAMES.has(n) ? n : (_sLower.get(n.toLowerCase()) ?? null);
                  const TAG_HEX: Record<string, string> = { red:"#EF4444", orange:"#F97316", yellow:"#EAB308", green:"#22C55E", blue:"#3B82F6", indigo:"#6366F1", purple:"#A855F7", pink:"#EC4899", gray:"#6B7280" };

                  type TLItem =
                    | { kind: "msg"; data: Interaction; ts: string }
                    | { kind: "tag"; tagName: string; tagColor: string; timeStr: string; eventType: string; ts: string }
                    | { kind: "status"; statusName: string; timeStr: string; hex: string; ts: string };

                  // Synthetic status events from interaction patterns
                  const existingLower = new Set(tagEvents.map((te: any) => (te.tag_name || "").toLowerCase()));
                  const synthEvents: any[] = [];
                  let inboundN = 0;
                  for (const m of interactions) {
                    if ((m.direction || "").toLowerCase() !== "outbound") {
                      inboundN++;
                      if (inboundN === 1 && !existingLower.has("responded")) {
                        synthEvents.push({ tag_name: "Responded", tag_color: "", created_at: m.created_at ?? (m as any).createdAt, event_type: "added" });
                      }
                      if (inboundN === 2 && !existingLower.has("multiple responses") && !existingLower.has("multiple messages")) {
                        synthEvents.push({ tag_name: "Multiple Responses", tag_color: "", created_at: m.created_at ?? (m as any).createdAt, event_type: "added" });
                      }
                    }
                  }
                  const allTE = [...tagEvents, ...synthEvents];

                  const items: TLItem[] = [
                    ...interactions.map(m => ({ kind: "msg" as const, data: m, ts: m.created_at ?? (m as any).createdAt ?? "" })),
                    ...allTE.map(te => {
                      const ts = te.created_at ?? "";
                      const timeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                      const canonical = findCanonical(te.tag_name);
                      if (canonical && te.event_type !== "removed") {
                        return { kind: "status" as const, statusName: canonical, timeStr, hex: STATUS_HEX[canonical] ?? "#6B7280", ts };
                      }
                      return { kind: "tag" as const, tagName: te.tag_name, tagColor: te.tag_color ?? "gray", timeStr, eventType: te.event_type, ts };
                    }),
                  ].sort((a, b) => a.ts.localeCompare(b.ts));

                  return items.map((item, idx) => {
                    if (item.kind === "status") {
                      return (
                        <div key={`status-${idx}`} className="flex justify-center py-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1 bg-white dark:bg-gray-900 shadow-sm select-none" style={{ color: item.hex }}>
                            <Activity className="w-3 h-3" style={{ color: item.hex }} />
                            {item.statusName}
                            {item.timeStr && <span className="opacity-50">· {item.timeStr}</span>}
                          </span>
                        </div>
                      );
                    }
                    if (item.kind === "tag") {
                      const isRemoved = item.eventType === "removed";
                      const hex = TAG_HEX[item.tagColor] ?? "#6B7280";
                      return (
                        <div key={`tag-${idx}`} className={cn("flex justify-center py-1", isRemoved && "opacity-50")}>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1 bg-white dark:bg-gray-900 shadow-sm select-none" style={{ color: hex }}>
                            <Tag className="w-3 h-3" style={{ color: hex }} />
                            <span className={cn(isRemoved && "line-through")}>{item.tagName}</span>
                            {item.timeStr && <span className="opacity-50">· {item.timeStr}</span>}
                          </span>
                        </div>
                      );
                    }
                    // msg item
                    const m = item.data;
                    const outbound = String(m.direction || "").toLowerCase() === "outbound";
                    const AI_TB = new Set(["ai_conversation", "campaign_launcher", "bump_scheduler",
                      "manual_bump_trigger", "inbound_handler", "booking_webhook", "booking_confirmation"]);
                    const isAI = Boolean(m.ai_generated || (m as any).aiGenerated)
                      || Boolean(m.is_bump || (m as any).isBump)
                      || AI_TB.has(((m as any).triggered_by ?? (m as any).triggeredBy ?? "").toLowerCase());
                    const isHuman = Boolean(m.is_manual_follow_up);
                    const isBump = Boolean(m.is_bump);
                    const msgContent = m.Content || m.content || "";
                    const who = m.Who || m.who || "";
                    const iconCfg = isAI
                      ? { icon: Bot, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10" }
                      : isHuman && outbound
                        ? { icon: User, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10" }
                        : outbound
                          ? { icon: Send, color: "text-brand-indigo", bg: "bg-brand-indigo/10" }
                          : { icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" };
                    const IconComp = iconCfg.icon;
                    return (
                      <div
                        key={m.id}
                        className="flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-card"
                        data-testid={`lead-detail-interaction-${m.id}`}
                        data-index={idx}
                        data-direction={m.direction}
                        data-ai-generated={isAI ? "true" : "false"}
                      >
                        <div className={cn("shrink-0 flex items-center justify-center rounded-lg h-7 w-7", iconCfg.bg)}>
                          <IconComp className={cn("h-4 w-4", iconCfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-medium text-foreground leading-snug truncate">
                              {outbound ? (isAI ? t("timeline.aiSent") : isHuman ? t("timeline.agentSent") : t("timeline.sent")) : t("timeline.received")}
                              {isBump && <span className="text-amber-600 dark:text-amber-400 ml-1">· {t("timeline.bump")}</span>}
                              {m.type && m.type !== "SMS" && (
                                <span className="text-muted-foreground/70 ml-1">· {m.type}</span>
                              )}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {msgContent || <span className="italic">{"2014"}</span>}
                          </p>
                          {who && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t("timeline.via", { who })}</p>
                          )}
                        </div>
                        <span
                          className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5"
                          data-testid={`interaction-timestamp-${m.id}`}
                        >
                          {fmtDateTime(m.created_at)}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
    </>
  );
}
