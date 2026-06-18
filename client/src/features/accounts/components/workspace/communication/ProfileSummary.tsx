import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles, SlidersHorizontal, Eye, Quote, Bot, MessageSquareWarning, Handshake,
  Banknote, Wallet, Truck, ShieldCheck, HelpCircle, Award, AlertTriangle,
  CheckCircle2, XCircle,
} from "lucide-react";
import {
  STEPS, formalityKey,
  type ProfileAnswers, type PreferredWordGroup, type FactValues, type SectionKey,
} from "./profileConstants";
import type { QAGrids } from "./useOnboardingFacts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STEP_ICON: Record<string, LucideIcon> = {
  openingStyle: Sparkles,
  formality: SlidersHorizontal,
  perception: Eye,
  preferredWords: Quote,
  agentName: Bot,
  objections: MessageSquareWarning,
  negotiation: Handshake,
  financing: Banknote,
  installments: Wallet,
  deliveryTime: Truck,
  guarantees: ShieldCheck,
  faq: HelpCircle,
  differentiator: Award,
  sensitiveTopics: AlertTriangle,
};

// Reuses the existing pipeline "stage" palette (already theme-safe in light + dark
// mode) so each item gets a genuinely distinct hue instead of a single-color shade.
const STEP_COLOR: Record<string, string> = {
  openingStyle: "var(--stage-new)",
  formality: "var(--stage-contacted)",
  perception: "var(--stage-responded)",
  preferredWords: "var(--stage-multi)",
  agentName: "var(--stage-qualified)",
  objections: "var(--stage-lost)",
  negotiation: "var(--stage-booked)",
  financing: "var(--stage-qualified)",
  installments: "var(--stage-multi)",
  deliveryTime: "var(--stage-contacted)",
  guarantees: "var(--stage-responded)",
  faq: "var(--stage-new)",
  differentiator: "var(--stage-closed)",
  sensitiveTopics: "var(--stage-lost)",
};

// Left column = (tone+identity merged, shown under the "tone" header) + sales.
// Right column = facts. Each inner array is a group of sections rendered under
// one shared header (the first section's i18n label).
const SECTION_COLUMNS: SectionKey[][][] = [
  [["tone", "identity"], ["sales"]],
  [["facts"]],
];

export function ProfileSummary({ answers, facts, grids, onEditStep }: {
  answers: ProfileAnswers; facts: FactValues; grids: QAGrids; onEditStep: (stepIndex: number) => void;
}) {
  const { t } = useTranslation("communicationProfile");
  const notSet = t("summary.notSet");

  function label(key: string, kind: string) {
    const ns = kind === "fact" ? "facts" : "questions";
    return t(`${ns}.${key}.short`, { defaultValue: t(`${ns}.${key}.label`) });
  }

  function qagridRows(key: string): string[] {
    return (grids[key] ?? []).filter((r) => r.question.trim() && r.answer.trim()).map((r) => r.question.trim());
  }

  function value(key: string, kind: string): string {
    if (kind === "fact") return (facts[key] ?? "").trim() || notSet;
    if (kind === "qagrid") {
      const rows = qagridRows(key);
      return rows.length ? rows.join(" / ") : notSet;
    }
    switch (key) {
      case "openingStyle":
        return answers.openingStyle ? t(`questions.openingStyle.options.${answers.openingStyle}.label`) : notSet;
      case "statusQuestion":
        return answers.statusQuestion ? t(`questions.statusQuestion.options.${answers.statusQuestion}.label`) : notSet;
      case "formality": {
        const k = formalityKey(answers.formality);
        return k ? t(`questions.formality.levels.${k}.label`) : notSet;
      }
      case "perception":
        return answers.perception.length ? answers.perception.map((v) => t(`questions.perception.options.${v}.label`)).join(", ") : notSet;
      case "preferredWords": {
        const words = (Object.keys(answers.preferredWords) as PreferredWordGroup[])
          .map((g) => answers.preferredWords[g]).filter(Boolean).map((w) => cap(w as string));
        return words.length ? words.join(", ") : notSet;
      }
      case "agentName": {
        const name = answers.agentNameCustom || (answers.agentName ? t(`questions.agentName.options.${answers.agentName}.label`) : "");
        const avatar = answers.avatarChoice ? t(`questions.agentName.avatar.${answers.avatarChoice}.label`) : "";
        if (!name && !avatar) return notSet;
        return [name, avatar].filter(Boolean).join(" · ");
      }
      case "differentiator": {
        const rows = answers.differentiator.split("\n").map((r) => r.trim()).filter(Boolean);
        return rows.length ? rows.join(" / ") : notSet;
      }
      case "bookingUrl":
        return answers.bookingUrl.trim() || notSet;
      default:
        return notSet;
    }
  }

  // Steps with their original index (used to open the wizard at the right step).
  const indexed = STEPS.map((s, i) => ({ s, i }));

  const completedCount = indexed.filter(({ s }) => value(s.key, s.kind) !== notSet).length;
  const totalCount = indexed.length;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Overall progress — single bar for the whole profile, not per section/item. */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
            {pct === 100 ? t("summary.complete") : t("summary.itemsMissing", { count: totalCount - completedCount })}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--wine)" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--mute-2)", opacity: 0.25, overflow: "hidden" }}>
          <div
            style={{
              height: "100%", borderRadius: 3, width: `${pct}%`,
              background: pct === 100 ? "var(--good)" : "var(--wine)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Left column = "Identity and Style" (tone+identity merged) + sales, right column = facts. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, alignItems: "start" }}>
        {SECTION_COLUMNS.map((column, colIdx) => (
          <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {column.map((group) => {
              const items = indexed.filter(({ s }) => group.includes(s.section));
              if (!items.length) return null;
              return (
                <div key={group.join("+")}>
                  {/* Section header — flat, no chrome, left-aligned with the icons below. */}
                  <div
                    style={{
                      padding: "11px 6px", background: "var(--paper)", marginBottom: 6,
                    }}
                  >
                    <h4 className="serif" style={{ margin: 0, fontSize: 20, color: "var(--ink-soft)", lineHeight: 1, letterSpacing: "-0.01em" }}>
                      {t(`sections.${group[0]}`)}
                    </h4>
                  </div>

                  {/* Points — flat on the card's white background, no inset chrome. */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {items.map(({ s, i }) => {
                      const v = value(s.key, s.kind);
                      const isSet = v !== notSet;
                      const Icon = STEP_ICON[s.key] ?? HelpCircle;
                      const color = STEP_COLOR[s.key] ?? "var(--wine)";
                      const shade = `color-mix(in srgb, ${color} 18%, var(--paper))`;
                      return (
                        <button
                          type="button"
                          key={s.key}
                          onClick={() => onEditStep(i)}
                          style={{
                            textAlign: "left", width: "100%", padding: "10px 6px", background: "transparent",
                            border: "none", cursor: "pointer", display: "flex", gap: 14, alignItems: "center",
                          }}
                        >
                          <span style={{ position: "relative", flexShrink: 0 }}>
                            <span
                              style={{
                                width: 44, height: 44, borderRadius: "50%", background: shade,
                                display: "flex", alignItems: "center", justifyContent: "center", color,
                              }}
                            >
                              <Icon size={21} />
                            </span>
                            {/* Status tag — top-right corner of the icon circle. */}
                            <span
                              style={{
                                position: "absolute", top: -4, right: -4, width: 18, height: 18,
                                borderRadius: "50%", background: "var(--paper)", boxShadow: "0 0 0 2px var(--paper)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >
                              {isSet ? (
                                <CheckCircle2 size={16} style={{ color: "var(--good)" }} />
                              ) : (
                                <XCircle size={16} className="text-red-600" />
                              )}
                            </span>
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4 }}>{label(s.key, s.kind)}</span>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: isSet ? "var(--wine)" : "var(--mute-2)", fontStyle: isSet ? "normal" : "italic", lineHeight: 1.4 }}>{v}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
