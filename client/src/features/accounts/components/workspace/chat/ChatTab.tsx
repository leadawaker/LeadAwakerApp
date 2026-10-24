// The chat receptionist's settings (specs/account-service-settings), shown as
// Chats > Settings (receptionist/ReceptionistSettings.tsx): the website chat
// and WhatsApp receptionist, set up per account instead of on the Campaigns
// page. It edits the account's receptionist campaign through the campaign
// settings' own draft + 1.5s autosave (useCampaignDetail), so the two pages
// share one copy and one save path. Same rail as Calls > Settings; the client
// sees it read-only. The Owner also gets Advanced: the engine fields the other
// sections leave out (ChatAdvanced).
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { BookOpen, Bot, Clock, Hand, LayoutDashboard, Loader2, MessageSquareText, ArrowRight, Check, SlidersHorizontal } from "lucide-react";
import { useCampaignDetail } from "@/features/campaigns/components/useCampaignDetail";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLastTab } from "@/hooks/useLastTab";
import type { Campaign } from "@/types/models";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "../SectionRail";
import { ReadOnlyNote, hhmm, useLocalized, type ChatEdit } from "./chatAtoms";
import { receptionistCampaignId, useChatCampaign, useChatWidget, type ChatCampaign } from "./useChatCampaign";
import { ChatOverview, widgetLive } from "./ChatOverview";
import { ChatGreeting } from "./ChatGreeting";
import { ChatBehaviour, ChatKnowledge } from "./ChatBehaviour";
import { ChatFollowUp, ChatHours, followUpOn, isReceptionistBump } from "./ChatFollowUp";
import { ChatAdvanced } from "./ChatAdvanced";

/** Every section a link may name. "advanced" opens only for the Owner; anyone else lands on Overview. */
export const CHAT_SECTIONS = ["overview", "greeting", "behaviour", "knowledge", "followup", "hours", "advanced"] as const;
export type ChatSection = (typeof CHAT_SECTIONS)[number];

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>{children}</div>;
}

export function ChatTab({ accountId, inboundCampaignId, readOnly = false, stacked = false, onOpenIntegrations, initialSection, knowledgeNote }: {
  accountId: number; inboundCampaignId: unknown; readOnly?: boolean; stacked?: boolean; onOpenIntegrations?: () => void;
  /** The section a link opens on (?section=). */
  initialSection?: ChatSection;
  /** One line at the top of Knowledge (the hours and Company Intel are shared with Calls). */
  knowledgeNote?: ReactNode;
}) {
  const { t } = useTranslation("chatTab");
  const { widget, loading: widgetLoading, save: saveWidget } = useChatWidget(accountId);
  const campaignId = receptionistCampaignId(inboundCampaignId, widget);
  const { campaign, loading, error, onSave } = useChatCampaign(campaignId);

  if (widgetLoading || loading) return <Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>;
  if (error) {
    return (
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 32, textAlign: "center", color: "var(--mute)", fontSize: 13.5 }}>
        {t("loadFailed")}
      </div>
    );
  }
  if (!campaign) return <ChatEmpty readOnly={readOnly} />;

  return (
    <ChatSections
      // A different campaign is a different draft.
      key={campaign.id}
      accountId={accountId} campaign={campaign} onSave={onSave} canEdit={!readOnly} stacked={stacked}
      widget={widget} saveWidget={saveWidget} onOpenIntegrations={readOnly ? undefined : onOpenIntegrations}
      initialSection={initialSection} knowledgeNote={knowledgeNote}
    />
  );
}

/** No receptionist campaign yet. Creating one here is not offered: see the spec's Status line. */
function ChatEmpty({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation("chatTab");
  return (
    <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "36px 28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }} data-testid="chat-empty">
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{t("empty.title")}</div>
      <p style={{ margin: 0, maxWidth: 460, fontSize: 13, color: "var(--mute)", lineHeight: 1.5 }}>{t(readOnly ? "empty.helpClient" : "empty.help")}</p>
      {!readOnly && (
        <Link href="/platform/campaigns" className="la-btn la-btn--soft" data-testid="chat-empty-campaigns">
          {t("empty.openCampaigns")} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

function ChatSections({ accountId, campaign, onSave, canEdit, stacked, widget, saveWidget, onOpenIntegrations, initialSection, knowledgeNote }: {
  accountId: number; campaign: ChatCampaign; onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  canEdit: boolean; stacked: boolean; widget: ReturnType<typeof useChatWidget>["widget"];
  saveWidget: ReturnType<typeof useChatWidget>["save"]; onOpenIntegrations?: () => void;
  initialSection?: ChatSection; knowledgeNote?: ReactNode;
}) {
  const { t } = useTranslation("chatTab");
  const { isOwner } = useWorkspace();
  // A ?section= link wins; otherwise the section used last reopens.
  const [picked, setSection] = useLastTab<ChatSection>("chats.settings", CHAT_SECTIONS, "overview", initialSection);
  // Advanced is the Owner's alone, also when a link names it.
  const section: ChatSection = picked === "advanced" && !isOwner ? "overview" : picked;
  const { draft, setDraft, saving, hasChanges } = useCampaignDetail(campaign as unknown as Campaign, onSave);
  const edit: ChatEdit = { campaign, draft, setDraft, canEdit };
  const loc = useLocalized(edit);

  const active = String(campaign.status ?? "").toLowerCase() === "active";
  const start = hhmm(draft.active_hours_start);
  const end = hhmm(draft.active_hours_end);
  const name = String(draft.agent_name || "");
  const items: SectionRailItem<ChatSection>[] = [
    {
      key: "overview", icon: <LayoutDashboard size={16} />, label: t("rail.overview.label"),
      state: active ? (widgetLive(widget) ? "on" : "pending") : "off",
      detail: active ? t("rail.overview.active") : t("rail.overview.inactive", { status: campaign.status ?? "" }),
    },
    {
      key: "greeting", icon: <Hand size={16} />, label: t("rail.greeting.label"),
      state: widget?.greeting ? "on" : "off",
      detail: widget?.greeting || t("rail.greeting.none"),
    },
    {
      key: "behaviour", icon: <Bot size={16} />, label: t("rail.behaviour.label"),
      state: name && loc.get("ai_style_override") ? "on" : "pending",
      detail: [name, t(`behaviour.languages.${String(draft.language || "en")}`)].filter(Boolean).join(" · "),
    },
    {
      key: "knowledge", icon: <BookOpen size={16} />, label: t("rail.knowledge.label"),
      state: loc.get("kb") ? (draft.calendar_link_override ? "on" : "pending") : "off",
      detail: draft.calendar_link_override ? t("rail.knowledge.withLink") : t("rail.knowledge.noLink"),
    },
    {
      key: "followup", icon: <MessageSquareText size={16} />, label: t("rail.followup.label"),
      state: isReceptionistBump(campaign) && followUpOn(draft) ? "on" : "off",
      detail: !isReceptionistBump(campaign) ? t("rail.followup.other") : t(followUpOn(draft) ? "rail.followup.on" : "rail.followup.off"),
    },
    {
      key: "hours", icon: <Clock size={16} />, label: t("rail.hours.label"),
      state: start && end ? "on" : "off",
      detail: start && end ? t("hours.range", { start, end }) : t("hours.unset"),
    },
    // An Owner tool, not a setting with a state: no dot.
    ...(isOwner ? [{
      key: "advanced" as const, icon: <SlidersHorizontal size={16} />, label: t("rail.advanced.label"),
      detail: String(draft.ai_model || "") || t("advanced.modelDefault"),
    }] : []),
  ];
  const index = items.findIndex((i) => i.key === section) + 1;

  return (
    <SectionLayout
      stacked={stacked}
      testId="chat-tab"
      rail={(layout) => <SectionRail items={items} active={section} onSelect={setSection} layout={layout} testId="chat-rail" />}
    >
      <section style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }} data-testid={`chat-section-${section}`}>
        <SectionHeader index={index} title={t(`rail.${section}.label`)} help={t(`rail.${section}.help`)} />
        {!canEdit && <ReadOnlyNote />}
        {canEdit && section !== "overview" && section !== "greeting" && <SaveState saving={saving} pending={hasChanges} />}

        {section === "overview" && <ChatOverview accountId={accountId} campaign={campaign} widget={widget} onOpenIntegrations={onOpenIntegrations} />}
        {section === "greeting" && <ChatGreeting widget={widget} canEdit={canEdit} onSaveWidget={saveWidget} />}
        {section === "behaviour" && <ChatBehaviour {...edit} />}
        {section === "knowledge" && <>{knowledgeNote}<ChatKnowledge {...edit} /></>}
        {section === "followup" && <ChatFollowUp {...edit} />}
        {section === "hours" && <ChatHours {...edit} />}
        {section === "advanced" && <ChatAdvanced {...edit} />}
      </section>
    </SectionLayout>
  );
}

/** Autosave has no button: one quiet line says whether the last change is stored. */
function SaveState({ saving, pending }: { saving: boolean; pending: boolean }) {
  const { t } = useTranslation("chatTab");
  return (
    <p role="status" data-testid="chat-save-state" style={{ margin: 0, fontSize: 12, color: "var(--mute)", display: "flex", alignItems: "center", gap: 6 }}>
      {saving ? <Loader2 size={12} className="animate-spin" /> : pending ? null : <Check size={12} />}
      {t(saving ? "save.saving" : pending ? "save.pending" : "save.saved")}
    </p>
  );
}
