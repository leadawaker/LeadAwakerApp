// The chat receptionist's settings (specs/account-service-settings), shown as
// Chats > Settings (receptionist/ReceptionistSettings.tsx): the website chat
// and WhatsApp receptionist, set up per account instead of on the Campaigns
// page. It edits the account's receptionist campaign through the campaign
// settings' own draft + 1.5s autosave (useCampaignDetail), so the two pages
// share one copy and one save path. Same rail as Calls > Settings; the client
// sees it read-only. The Owner also gets Advanced: the engine fields the other
// sections leave out (ChatAdvanced).
//
// WhatsApp and the website chat each answer from their own campaign (the engine
// reads Accounts.inbound_campaign_id and Widget_Configs.Campaigns_id apart), so
// a channel switch picks which one these sections edit. While both still point
// at one campaign, the agency can give the website its own copy (chatSplit.ts).
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { BookOpen, Bot, Clock, FileText, Globe, Hand, LayoutDashboard, Link2, Loader2, MessageCircle, MessageSquareText, ArrowRight, Check, SlidersHorizontal } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
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
import { ChatPrompt } from "./ChatPrompt";
import { CHAT_SERVICES, ChatServiceBar, ChatServiceSoon, isSoon, useChatService } from "./ChatServices";
import { AccountReactivationTab } from "../reactivation/AccountReactivationTab";

/**
 * Every section a link may name. "prompt" opens only for the agency and "advanced" only for the
 * Owner; anyone else lands on Overview.
 */
export const CHAT_SECTIONS = ["overview", "greeting", "behaviour", "prompt", "knowledge", "followup", "hours", "advanced"] as const;
export type ChatSection = (typeof CHAT_SECTIONS)[number];

export const CHAT_CHANNELS = ["whatsapp", "website"] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>{children}</div>;
}

type ChatTabProps = {
  accountId: number; inboundCampaignId: unknown; readOnly?: boolean; stacked?: boolean; onOpenIntegrations?: () => void;
  /** The account's name, for a new reactivation campaign. */
  accountName?: string;
  /** The section a link opens on (?section=). */
  initialSection?: ChatSection;
  /** One line at the top of Knowledge (the hours and Company Intel are shared with Calls). */
  knowledgeNote?: ReactNode;
};

/** One tab per service (ChatServices.tsx); Reactivation is the agency's (Accounts > Reactivation). */
export function ChatTab(props: ChatTabProps) {
  const { isAgencyUser } = useWorkspace();
  const services = CHAT_SERVICES.filter((s) => s !== "reactivation" || isAgencyUser);
  const [service, setService] = useChatService(services, !!props.initialSection);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <ChatServiceBar services={services} service={service} onService={setService} />
      {service === "speed_to_lead" && <SpeedToLeadChat {...props} />}
      {service === "reactivation" && (
        <AccountReactivationTab key={props.accountId} accountId={props.accountId} accountName={props.accountName ?? ""} readOnly={!!props.readOnly} isMobile={!!props.stacked} />
      )}
      {isSoon(service) && <ChatServiceSoon service={service} />}
    </div>
  );
}

/** Speed to Lead: the receptionist answering on WhatsApp and the website chat, one campaign per channel. */
function SpeedToLeadChat({ accountId, inboundCampaignId, readOnly = false, stacked = false, onOpenIntegrations, initialSection, knowledgeNote }: ChatTabProps) {
  const { t } = useTranslation("chatTab");
  const { isAgencyUser } = useWorkspace();
  const qc = useQueryClient();
  const { widget, loading: widgetLoading, save: saveWidget } = useChatWidget(accountId);
  const inbound = Number(inboundCampaignId);
  const whatsappId = Number.isSafeInteger(inbound) && inbound > 0 ? inbound : null;
  const websiteId = widget?.campaignsId ?? null;
  // The channels this account has: a WhatsApp campaign, a website widget.
  const channels = CHAT_CHANNELS.filter((c) => (c === "whatsapp" ? !!whatsappId : !!widget));
  const [pickedChannel, setChannel] = useLastTab<ChatChannel>("chats.channel", CHAT_CHANNELS, "whatsapp");
  const channel: ChatChannel | null = channels.includes(pickedChannel) ? pickedChannel : channels[0] ?? null;
  const campaignId = channel === "whatsapp" ? whatsappId : channel === "website" ? websiteId : receptionistCampaignId(inboundCampaignId, widget);
  const { campaign, loading, error, onSave } = useChatCampaign(campaignId);
  const shared = !!whatsappId && whatsappId === websiteId;
  const [splitting, setSplitting] = useState(false);
  const [splitFailed, setSplitFailed] = useState(false);

  const split = async () => {
    setSplitting(true);
    setSplitFailed(false);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/chat/split-website`, { method: "POST" });
      if (!res.ok) throw new Error();
      await qc.invalidateQueries({ queryKey: ["/api/widget-configs", accountId] });
      setChannel("website");
    } catch {
      setSplitFailed(true);
    } finally {
      setSplitting(false);
    }
  };

  const bar = channels.length > 1 || shared ? (
    <ChannelBar
      channels={channels} channel={channel} onChannel={setChannel} shared={shared}
      onSplit={isAgencyUser && !readOnly ? () => void split() : undefined} splitting={splitting} splitFailed={splitFailed}
    />
  ) : null;

  if (widgetLoading || loading) return <Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>;
  if (error) {
    return (
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 32, textAlign: "center", color: "var(--mute)", fontSize: 13.5 }}>
        {t("loadFailed")}
      </div>
    );
  }
  if (!campaign) return <>{bar}<ChatEmpty readOnly={readOnly} /></>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      {bar}
      <ChatSections
        // A different campaign is a different draft.
        key={campaign.id}
        accountId={accountId} campaign={campaign} onSave={onSave} canEdit={!readOnly} stacked={stacked} channel={channel}
        widget={widget} saveWidget={saveWidget} onOpenIntegrations={readOnly ? undefined : onOpenIntegrations}
        initialSection={initialSection} knowledgeNote={knowledgeNote}
      />
    </div>
  );
}

const CHANNEL_ICON: Record<ChatChannel, ReactNode> = { whatsapp: <MessageCircle size={14} />, website: <Globe size={14} /> };

/** WhatsApp | Website, and while they share one campaign, a note with the button that separates them. */
function ChannelBar({ channels, channel, onChannel, shared, onSplit, splitting, splitFailed }: {
  channels: ChatChannel[]; channel: ChatChannel | null; onChannel: (c: ChatChannel) => void; shared: boolean;
  onSplit?: () => void; splitting: boolean; splitFailed: boolean;
}) {
  const { t } = useTranslation("chatTab");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="chat-channels">
      {channels.length > 1 && (
        <div className="la-seg" role="radiogroup" aria-label={t("channels.label")} style={{ alignSelf: "flex-start" }}>
          {channels.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={channel === c} className={channel === c ? "la-seg-btn on" : "la-seg-btn"}
              onClick={() => onChannel(c)} data-testid={`chat-channel-${c}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {CHANNEL_ICON[c]}{t(`channels.${c}`)}
            </button>
          ))}
        </div>
      )}
      {shared && (
        <div className="neu-inset-crisp" data-testid="chat-channels-shared"
          style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: "var(--r-button)", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>
          <Link2 size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 200 }}>{t("channels.shared")}</span>
          {onSplit && (
            <button type="button" className="la-btn la-btn--soft" onClick={onSplit} disabled={splitting} data-testid="chat-channels-split">
              {splitting && <Loader2 size={13} className="animate-spin" />}{t("channels.split")}
            </button>
          )}
          {splitFailed && <span role="alert" style={{ width: "100%", color: "var(--stage-lost)" }}>{t("channels.splitFailed")}</span>}
        </div>
      )}
    </div>
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

function ChatSections({ accountId, campaign, onSave, canEdit, stacked, channel, widget, saveWidget, onOpenIntegrations, initialSection, knowledgeNote }: {
  accountId: number; campaign: ChatCampaign; onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  canEdit: boolean; stacked: boolean; channel: ChatChannel | null; widget: ReturnType<typeof useChatWidget>["widget"];
  saveWidget: ReturnType<typeof useChatWidget>["save"]; onOpenIntegrations?: () => void;
  initialSection?: ChatSection; knowledgeNote?: ReactNode;
}) {
  const { t } = useTranslation("chatTab");
  const { isOwner, isAgencyUser } = useWorkspace();
  // A ?section= link wins; otherwise the section used last reopens.
  const [picked, setSection] = useLastTab<ChatSection>("chats.settings", CHAT_SECTIONS, "overview", initialSection);
  // Advanced is the Owner's alone and Prompt the agency's, also when a link names them.
  // Greeting is the widget's opening line and Follow-up the WhatsApp nudge: each shows on its own channel.
  const hidden = (s: ChatSection) =>
    (s === "advanced" && !isOwner) || (s === "prompt" && !isAgencyUser)
    || (s === "greeting" && channel === "whatsapp") || (s === "followup" && channel === "website");
  const section: ChatSection = hidden(picked) ? "overview" : picked;
  const { draft, setDraft, saving, hasChanges, linkedPrompt, conversationPrompts, reloadPrompts } = useCampaignDetail(campaign as unknown as Campaign, onSave);
  const edit: ChatEdit = { campaign, draft, setDraft, canEdit };
  const loc = useLocalized(edit);

  const active = String(campaign.status ?? "").toLowerCase() === "active";
  const start = hhmm(draft.active_hours_start);
  const end = hhmm(draft.active_hours_end);
  const name = String(draft.agent_name || "");
  const allItems: SectionRailItem<ChatSection>[] = [
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
    ...(isAgencyUser ? [{
      key: "prompt" as const, icon: <FileText size={16} />, label: t("rail.prompt.label"),
      state: linkedPrompt ? "on" as const : "off" as const,
      detail: linkedPrompt ? `${linkedPrompt.name} · #${linkedPrompt.id ?? linkedPrompt.Id}` : t("prompt.none"),
    }] : []),
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
  const items = allItems.filter((i) => !hidden(i.key));
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
        {section === "prompt" && <ChatPrompt {...edit} prompts={conversationPrompts} linkedPrompt={linkedPrompt} reloadPrompts={reloadPrompts} />}
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
