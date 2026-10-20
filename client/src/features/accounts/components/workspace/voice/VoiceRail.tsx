// The Phone tab's menu: one tile per section with its state and the one fact
// that matters (the number, her name, the transfer). Drawn by SectionRail.
import { useVoiceT } from "./voiceGender";
import { BookOpen, FilePenLine, LayoutDashboard, MessageSquareText, PhoneCall } from "lucide-react";
import { spokenAgentName } from "../communication/setupConstants";
import { VOICE_SECTIONS, type VoiceSection } from "./readiness";
import { SectionRail, type SectionState } from "../SectionRail";
import type { ReadinessKey, VoiceLine } from "./voiceApi";


const ICON: Record<VoiceSection, React.ReactNode> = {
  overview: <LayoutDashboard size={16} />,
  prompt: <FilePenLine size={16} />,
  knowledge: <BookOpen size={16} />,
  call: <PhoneCall size={16} />,
  after: <MessageSquareText size={16} />,
};

/** The readiness items each section answers for. */
const SECTION_ITEMS: Partial<Record<VoiceSection, ReadinessKey[]>> = {
  prompt: ["voice", "agent"],
  knowledge: ["persona", "kb", "hours"],
  call: ["transfer"],
};

export const sectionAnchorId = (section: VoiceSection) => `voice-section-${section}`;

/** The name she answers with on a call: a typed name, else the picked one, as the engine resolves it. */
export function effectiveAgentName(line: Pick<VoiceLine, "agentName" | "agentNameCustom" | "voice" | "locale">): string {
  const picked = line.agentNameCustom?.trim() || line.agentName?.trim() || "";
  const name = picked ? picked.charAt(0).toUpperCase() + picked.slice(1) : "";
  return spokenAgentName(name, line.voice ?? "", line.locale ?? "");
}

function sectionState(section: VoiceSection, line: VoiceLine): SectionState {
  if (section === "overview") return line.readiness.ready ? "on" : "pending";
  if (section === "after") return line.followUp?.enabled ? "on" : "off";
  const keys = SECTION_ITEMS[section] ?? [];
  const items = line.readiness.items.filter((i) => keys.includes(i.key));
  if (items.length === 0) return "on";
  if (items.every((i) => i.ok)) return "on";
  return items.some((i) => i.ok) ? "pending" : "off";
}

export function VoiceRail({ line, sections = VOICE_SECTIONS, active, onSelect, layout }: {
  line: VoiceLine;
  /** The sections this viewer gets (Prompt & test is Owner only). */
  sections?: readonly VoiceSection[];
  active: VoiceSection;
  onSelect: (section: VoiceSection) => void;
  layout: "rail" | "grid";
}) {
  const { t } = useVoiceT();
  const missing = line.readiness.items.filter((i) => !i.ok).length;
  const name = effectiveAgentName(line);
  const voice = line.voice ? line.voice.charAt(0).toUpperCase() + line.voice.slice(1) : "";

  const detail: Record<VoiceSection, string> = {
    prompt: [name, voice].filter(Boolean).join(" · ") || t("rail.prompt.detail"),
    overview: line.readiness.ready ? (line.number?.phoneNumber ?? t("rail.overview.ready")) : t("rail.overview.missing", { count: missing }),
    knowledge: t("rail.knowledge.detail", { count: line.kbCount }),
    call: line.transferMode === "off"
      ? t("rail.call.noTransfer")
      : line.transferName?.trim() || line.transferNumber || t("rail.call.noNumber"),
    after: t(line.followUp?.enabled ? "rail.after.on" : "rail.after.off"),
  };

  return (
    <SectionRail
      items={sections.map((section) => ({
        key: section, icon: ICON[section], label: t(`rail.${section}.label`), detail: detail[section], state: sectionState(section, line),
      }))}
      active={active}
      onSelect={onSelect}
      layout={layout}
      testId="voice-rail"
    />
  );
}
