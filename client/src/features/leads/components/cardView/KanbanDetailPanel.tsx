// Kanban detail panel (tabbed, compact) — extracted from LeadDetailView.tsx.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  FileText,
  MessageSquare,
  Phone,
  TrendingUp,
  ClipboardList,
  ExternalLink,
  X,
} from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { renderRichText } from "@/lib/richTextUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";

import { getFullName, getStatus, getScore } from "./leadUtils";
import { ScoreWidget } from "./ScoreWidgets";
import { ContactWidget } from "./ContactWidget";
import { ConversationWidget } from "./ConversationWidget";
import { ActivityTimeline } from "./DetailWidgets";

const getStatusAvatarColor = getLeadStatusAvatarColor;

type KanbanTab = "chat" | "contact" | "score" | "activity" | "notes";

export function KanbanDetailPanel({
  lead,
  onClose,
  leadTags,
  onOpenFullProfile,
}: {
  lead: Record<string, any>;
  onClose: () => void;
  leadTags: { name: string; color: string }[];
  onOpenFullProfile?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { isAgencyUser } = useWorkspace();
  const [activeTab, setActiveTab] = useState<KanbanTab>(isAgencyUser ? "chat" : "contact");

  const kanbanTabs: { id: KanbanTab; label: string; icon: typeof MessageSquare }[] = [
    ...(isAgencyUser ? [{ id: "chat" as KanbanTab, label: t("conversations.title"), icon: MessageSquare }] : []),
    { id: "contact",  label: t("contact.title"),       icon: Phone },
    { id: "score",    label: t("score.title"),          icon: TrendingUp },
    { id: "activity", label: t("detail.sections.activity"), icon: ClipboardList },
    { id: "notes",    label: t("detail.sections.notes"),    icon: FileText },
  ];

  const name       = getFullName(lead);
  const status     = getStatus(lead);
  const score      = getScore(lead);
  const avatarColor = getStatusAvatarColor(status);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card rounded-lg">

      {/* ── Header: avatar + name + X ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/20">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={72}
            />
            <div>
              <p className="text-[18px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">{name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{status || "—"}</p>
            </div>
          </div>
          {onOpenFullProfile && (
            <button
              onClick={onOpenFullProfile}
              title="Open full lead profile"
              className="flex items-center gap-1 text-[11px] font-medium text-brand-indigo/80 hover:text-brand-indigo transition-colors px-2 py-1 rounded-lg hover:bg-brand-indigo/5 shrink-0 mt-1"
            >
              <span>Full profile</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onClose}
            className="icon-circle-lg icon-circle-base shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 px-2 pt-2 pb-1 flex items-center gap-1">
        {kanbanTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium",
              activeTab === id
                ? "bg-highlight-active text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Active widget ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" && <ConversationWidget lead={lead} showHeader />}
        {activeTab === "contact" && (
          <div className="h-full overflow-y-auto p-3">
            <ContactWidget lead={lead} />
          </div>
        )}
        {activeTab === "score" && (
          <div className="h-full overflow-y-auto p-3">
            <ScoreWidget score={score} lead={lead} status={status} />
          </div>
        )}
        {activeTab === "activity" && (
          <div className="h-full overflow-hidden">
            <ActivityTimeline lead={lead} tagEvents={leadTags} />
          </div>
        )}
        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-[18px] font-semibold font-heading text-foreground mb-3">{t("detail.sections.notes")}</p>
            {lead.notes || lead.Notes ? (
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                {renderRichText(lead.notes || lead.Notes || "")}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">{t("activity.clickToAddNotes")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
