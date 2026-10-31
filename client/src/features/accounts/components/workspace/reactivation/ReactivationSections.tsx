// A reactivation campaign's settings, laid out like Chats > Settings > Speed to
// Lead: a rail of sections with a state dot and a one-line summary each, and one
// section open beside it. Replaces the Campaigns page's Business / AI / Behavior
// tabs here (that screen was built for screenshare demos). Every field below is
// one the engine reads (checked against the automations repo, 2026-10-31);
// account, contract, deal, campaign type, dates and the dead `type` column are
// left out on purpose. All edits land in useCampaignDetail's draft and autosave.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Bot, ChevronRight, FileText, LayoutDashboard, MessageSquare, Repeat, Send, SlidersHorizontal,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLastTab } from "@/hooks/useLastTab";
import { resolveLang } from "@shared/langField";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "../SectionRail";
import { ChatCard, ReadOnlyNote, hhmm, type ChatEdit } from "../chat/chatAtoms";
import { ChatPrompt } from "../chat/ChatPrompt";
import type { ReactivationSection } from "./reactivationLink";
import { RxFollowUps, RxOpener, bumpCount } from "./RxMessages";
import { RxBehaviour, RxKnowledge } from "./RxBehaviourKnowledge";
import { RxAdvanced, RxSending, channelChoice } from "./RxSendingAdvanced";

export const RX_SECTIONS = ["overview", "opener", "followups", "behaviour", "prompt", "knowledge", "sending", "advanced"] as const;
export type RxSection = (typeof RX_SECTIONS)[number];

/** Links from Home still name the old Campaigns-page tabs. */
const FROM_OLD: Record<ReactivationSection, RxSection> = { business: "opener", ai: "behaviour", behavior: "sending" };

export interface RxDetail {
  draft: Record<string, unknown>;
  setDraft: ChatEdit["setDraft"];
  linkedPrompt: any | null;
  conversationPrompts: any[];
  reloadPrompts: () => void;
}

export function ReactivationSections({ campaign, detail, canEdit, stacked, status, initialSection }: {
  campaign: Record<string, any>; detail: RxDetail; canEdit: boolean; stacked: boolean; status: string;
  initialSection?: ReactivationSection;
}) {
  const { t, i18n } = useTranslation("reactivationSettings");
  const { isOwner, isAgencyUser } = useWorkspace();
  const [picked, setSection] = useLastTab<RxSection>("reactivation.settings", RX_SECTIONS, "overview", initialSection ? FROM_OLD[initialSection] : null);
  const hidden = (s: RxSection) => (s === "advanced" && !isOwner) || (s === "prompt" && !isAgencyUser);
  const section: RxSection = hidden(picked) ? "overview" : picked;
  const { draft, setDraft } = detail;
  const edit: ChatEdit = { campaign: campaign as ChatEdit["campaign"], draft, setDraft, canEdit };
  const lang = i18n.language?.startsWith("nl") ? "nl" : "en";
  const text = (f: string) => resolveLang(draft[f] ?? campaign[f], lang);

  const opener = text("First_Message");
  const bumps = bumpCount(draft);
  const channel = channelChoice(draft);
  const name = String(draft.agent_name || "");
  const kb = text("kb") || text("description");
  const link = String(draft.calendar_link_override || "");
  const start = hhmm(draft.active_hours_start) || "09:00";
  const end = hhmm(draft.active_hours_end) || "17:00";
  const prompt = detail.linkedPrompt;

  const allItems: SectionRailItem<RxSection>[] = [
    { key: "overview", icon: <LayoutDashboard size={16} />, label: t("rail.overview.label"), detail: status },
    { key: "opener", icon: <MessageSquare size={16} />, label: t("rail.opener.label"), state: opener ? "on" : "off", detail: opener ? clip(opener) : t("state.notWritten") },
    { key: "followups", icon: <Repeat size={16} />, label: t("rail.followups.label"), state: bumps ? "on" : "off", detail: bumps ? t("state.followups", { count: bumps }) : t("state.followupsOff") },
    { key: "behaviour", icon: <Bot size={16} />, label: t("rail.behaviour.label"), state: name ? "on" : "pending", detail: name || t("state.unnamed") },
    ...(isAgencyUser ? [{
      key: "prompt" as const, icon: <FileText size={16} />, label: t("rail.prompt.label"),
      state: prompt ? "on" as const : "off" as const, detail: prompt ? `${prompt.name} · #${prompt.id ?? prompt.Id}` : t("state.noPrompt"),
    }] : []),
    { key: "knowledge", icon: <BookOpen size={16} />, label: t("rail.knowledge.label"), state: kb ? (link ? "on" : "pending") : "off", detail: !kb ? t("state.noKb") : t(link ? "state.withBookingLink" : "state.noBookingLink") },
    { key: "sending", icon: <Send size={16} />, label: t("rail.sending.label"), state: "on", detail: `${t(`sending.channels.${channel}.label`)} · ${t("overview.range", { start, end })}` },
    ...(isOwner ? [{ key: "advanced" as const, icon: <SlidersHorizontal size={16} />, label: t("rail.advanced.label"), detail: String(draft.ai_model || "") || t("advanced.modelDefault") }] : []),
  ];
  const items = allItems.filter((i) => !hidden(i.key));
  const index = items.findIndex((i) => i.key === section) + 1;

  const overviewRows: Array<{ key: RxSection; label: string; value: ReactNode }> = [
    { key: "opener", label: t("overview.opener"), value: opener ? clip(opener, 140) : t("state.notWritten") },
    { key: "followups", label: t("overview.followups"), value: bumps ? `${t("state.followups", { count: bumps })} · ${delays(draft, bumps)}` : t("state.followupsOff") },
    { key: "behaviour", label: t("overview.assistant"), value: name || t("state.unnamed") },
    { key: "knowledge", label: t("overview.booking"), value: link || t("overview.notSet") },
    { key: "sending", label: t("overview.channel"), value: t(`sending.channels.${channel}.label`) },
    { key: "sending", label: t("overview.window"), value: t("overview.windowValue", { start, end, limit: draft.daily_lead_limit || 500 }) },
    ...(isAgencyUser ? [{ key: "prompt" as const, label: t("overview.prompt"), value: prompt ? `${prompt.name} · #${prompt.id ?? prompt.Id}` : t("state.noPrompt") }] : []),
  ];

  return (
    <SectionLayout
      stacked={stacked}
      testId="rx-settings"
      rail={(layout) => <SectionRail items={items} active={section} onSelect={setSection} layout={layout} testId="rx-rail" />}
    >
      <section style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }} data-testid={`rx-section-${section}`}>
        <SectionHeader index={index} title={t(`rail.${section}.label`)} help={t(`rail.${section}.help`)} />
        {!canEdit && <ReadOnlyNote />}

        {section === "overview" && (
          <ChatCard icon={<LayoutDashboard size={17} />} title={t("overview.title")} testId="rx-card-overview">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {overviewRows.map((r, i) => (
                <button
                  key={`${r.key}-${i}`} type="button" onClick={() => setSection(r.key)} data-testid={`rx-overview-${r.key}`}
                  style={{
                    display: "grid", gridTemplateColumns: "minmax(110px, 160px) minmax(0, 1fr) 16px", alignItems: "center", gap: 14,
                    padding: "12px 2px", textAlign: "left", background: "none", border: "none", cursor: "pointer",
                    borderTop: i ? "1px solid var(--line)" : "none", color: "var(--ink)",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{r.label}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.45, minWidth: 0, overflowWrap: "anywhere" }}>{r.value}</span>
                  <ChevronRight size={15} style={{ color: "var(--mute-2)" }} />
                </button>
              ))}
            </div>
          </ChatCard>
        )}
        {section === "opener" && <RxOpener {...edit} />}
        {section === "followups" && <RxFollowUps {...edit} />}
        {section === "behaviour" && <RxBehaviour {...edit} />}
        {section === "prompt" && <ChatPrompt {...edit} prompts={detail.conversationPrompts} linkedPrompt={detail.linkedPrompt} reloadPrompts={detail.reloadPrompts} />}
        {section === "knowledge" && <RxKnowledge {...edit} />}
        {section === "sending" && <RxSending {...edit} />}
        {section === "advanced" && <RxAdvanced {...edit} />}
      </section>
    </SectionLayout>
  );
}

function clip(s: string, n = 70): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

function delays(draft: Record<string, unknown>, n: number): string {
  return Array.from({ length: n }, (_, i) => `${draft[`bump_${i + 1}_delay_hours`] || "?"}h`).join(", ");
}
