import { useTranslation } from "react-i18next";
import {
  STEPS, formalityKey, type ProfileAnswers, type PreferredWordGroup, type FactValues,
} from "./profileConstants";
import type { QAGrids } from "./useOnboardingFacts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ProfileSummary({ answers, facts, grids, onEditStep }: {
  answers: ProfileAnswers; facts: FactValues; grids: QAGrids; onEditStep: (stepIndex: number) => void;
}) {
  const { t } = useTranslation("communicationProfile");
  const notSet = t("summary.notSet");

  function label(key: string, kind: string) {
    return kind === "fact" ? t(`facts.${key}.label`) : t(`questions.${key}.label`);
  }

  function value(key: string, kind: string): string {
    if (kind === "fact") return (facts[key] ?? "").trim() || notSet;
    if (kind === "qagrid") {
      const rows = (grids[key] ?? []).filter((r) => r.question.trim() && r.answer.trim());
      return rows.length ? rows.map((r) => r.question.trim()).join(", ") : notSet;
    }
    switch (key) {
      case "openingStyle":
        return answers.openingStyle ? t(`questions.openingStyle.options.${answers.openingStyle}.label`) : notSet;
      case "statusQuestion":
        return answers.statusQuestion ? t(`questions.statusQuestion.options.${answers.statusQuestion}.label`) : notSet;
      case "formality": {
        const k = formalityKey(answers.formality);
        return k ? `${t(`questions.formality.levels.${k}.label`)} (${answers.addressForm === "u" ? "U" : "je"})` : notSet;
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
      default:
        return notSet;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {STEPS.map((s, i) => {
        const v = value(s.key, s.kind);
        const isSet = v !== notSet;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onEditStep(i)}
            className="neu-inset-crisp"
            style={{
              textAlign: "left", width: "100%", padding: "12px 15px", borderRadius: "var(--r-button)",
              background: "var(--bg)", border: "1px solid transparent", cursor: "pointer", display: "flex", gap: 12,
            }}
          >
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wine)", flexShrink: 0, marginTop: 1, width: 18 }}>{i + 1}.</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>{label(s.key, s.kind)}</span>
              <span style={{ display: "block", fontSize: 12.5, color: isSet ? "var(--mute)" : "var(--mute-2)", fontStyle: isSet ? "normal" : "italic", lineHeight: 1.5 }}>{v}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
