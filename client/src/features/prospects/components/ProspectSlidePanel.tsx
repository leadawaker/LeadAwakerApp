import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getAccountAvatarColor } from "@/lib/avatarUtils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProspectDetailView } from "./ProspectDetailView";
import { InteractionTimeline } from "./InteractionTimeline";
import { ProspectTasks } from "./ProspectTasks";
import type { ProspectRow } from "./ProspectListView";

// ── Status / priority helpers (shared with ProspectDetailView) ───────────────

const PRIORITY_HEX: Record<string, string> = {
  High:   "#EF4444",
  Medium: "#F59E0B",
  Low:    "#94A3B8",
};

function getStatusDotCls(status: string): string {
  switch (status) {
    case "New":          return "bg-blue-500";
    case "Contacted":    return "bg-amber-500";
    case "In Progress":  return "bg-indigo-500";
    case "Converted":    return "bg-emerald-500";
    case "Archived":     return "bg-slate-400";
    default:             return "bg-blue-400";
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ProspectSlidePanelProps {
  prospect: ProspectRow | null;
  onClose: () => void;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  onRefresh?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProspectSlidePanel({
  prospect,
  onClose,
  onSave,
  onDelete,
  onRefresh,
}: ProspectSlidePanelProps) {
  const { t } = useTranslation("prospects");
  const [activeTab, setActiveTab] = useState("overview");

  const isOpen = prospect !== null;
  const status = String(prospect?.status || "New");
  const priority = String(prospect?.priority || "Medium");
  const badgeStyle = getAccountAvatarColor(status);
  const prospectId = prospect ? (prospect.Id ?? prospect.id ?? 0) : 0;
  const companyName = prospect?.company || "";

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full md:w-[60vw] md:max-w-[900px] p-0 flex flex-col",
          "sm:max-w-none",
        )}
      >
        {prospect && (
          <>
            {/* ── Header ── */}
            <div className="shrink-0 border-b border-border/30 px-5 pt-5 pb-3">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                  style={prospect.photo_url ? {} : { backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
                >
                  {prospect.photo_url ? (
                    <img src={prospect.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(prospect.name || "?") || (
                      <Building2 className="w-5 h-5" />
                    )
                  )}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0 pr-8">
                  <SheetTitle className="text-[18px] font-semibold font-heading text-foreground leading-tight truncate">
                    {prospect.name || t("detail.unnamedProspect")}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Status badge */}
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotCls(status))} />
                      {status}
                    </span>
                    {/* Priority badge */}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${PRIORITY_HEX[priority] || "#94A3B8"}18`,
                        color: PRIORITY_HEX[priority] || "#94A3B8",
                      }}
                    >
                      {priority}
                    </span>
                    {prospect.company && (
                      <span className="text-[11px] text-foreground/50 truncate">
                        {prospect.company}
                      </span>
                    )}
                    <span className="text-[11px] text-foreground/40">#{prospectId}</span>
                  </div>
                </div>

                {/* Close button (the Sheet component adds one too, but this is explicit) */}
              </div>
            </div>

            {/* ── Tabs ── */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="shrink-0 border-b border-border/20 px-5">
                <TabsList className="h-10 bg-transparent p-0 gap-0 w-full justify-start rounded-none">
                  {(["overview", "enrichment", "interactions", "tasks", "notes"] as const).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className={cn(
                        "relative rounded-none border-b-2 border-transparent px-4 py-2 text-[13px] font-medium",
                        "data-[state=active]:border-brand-indigo data-[state=active]:text-brand-indigo",
                        "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                        "text-foreground/50 hover:text-foreground/70",
                      )}
                    >
                      {t(`slidePanel.tabs.${tab}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── Tab content ── */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <TabsContent value="overview" className="m-0 h-full">
                  <ProspectDetailView
                    prospect={prospect}
                    onSave={onSave}
                    onDelete={onDelete}
                  />
                </TabsContent>

                <TabsContent value="enrichment" className="m-0 p-5">
                  {prospect.ai_summary ? (
                    <div className="space-y-4">
                      {prospect.headline && (
                        <div className="bg-card/60 dark:bg-card/30 rounded-xl p-4">
                          <div className="text-[11px] text-foreground/40 mb-1">{t("fields.headline")}</div>
                          <p className="text-[13px] text-foreground font-medium">{prospect.headline}</p>
                          {(prospect.connection_count || prospect.follower_count) && (
                            <div className="flex gap-4 mt-2">
                              {prospect.connection_count && (
                                <span className="text-[11px] text-foreground/50">{Number(prospect.connection_count).toLocaleString()} {t("fields.connectionCount").toLowerCase()}</span>
                              )}
                              {prospect.follower_count && (
                                <span className="text-[11px] text-foreground/50">{Number(prospect.follower_count).toLocaleString()} {t("fields.followerCount").toLowerCase()}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {prospect.ai_summary && (
                        <div className="bg-card/60 dark:bg-card/30 rounded-xl p-4">
                          <div className="text-[11px] text-foreground/40 mb-1">{t("fields.aiSummary")}</div>
                          <p className="text-[12px] text-foreground leading-relaxed">{prospect.ai_summary}</p>
                        </div>
                      )}
                      {prospect.top_post && (
                        <div className="bg-card/60 dark:bg-card/30 rounded-xl p-4">
                          <div className="text-[11px] text-foreground/40 mb-1">{t("fields.topPost")}</div>
                          <p className="text-[12px] text-foreground/70 leading-relaxed italic">{prospect.top_post}</p>
                        </div>
                      )}
                      {prospect.conversation_starters && (
                        <div className="bg-card/60 dark:bg-card/30 rounded-xl p-4">
                          <div className="text-[11px] text-foreground/40 mb-1">{t("fields.conversationStarters")}</div>
                          <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{prospect.conversation_starters}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-foreground/30 text-[12px] italic">
                      {t("fields.notEnriched")}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="interactions" className="m-0 h-full">
                  <InteractionTimeline prospectId={prospectId} />
                </TabsContent>

                <TabsContent value="tasks" className="m-0 h-full">
                  <ProspectTasks prospectCompanyName={companyName} />
                </TabsContent>

                <TabsContent value="notes" className="m-0 p-5">
                  <div className="bg-card/60 dark:bg-card/30 rounded-xl p-4">
                    <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">
                      {prospect.notes || (
                        <span className="text-foreground/25 italic">
                          {t("slidePanel.emptyNotes")}
                        </span>
                      )}
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
