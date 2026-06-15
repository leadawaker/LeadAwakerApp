import { useTranslation } from "react-i18next";
import { FieldRow, GroupLabel } from "../atoms";
import { FACT_STEPS, type ProfileAnswers, type PreferredWordGroup, type FactValues } from "./profileConstants";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ProfileSummary({ answers, facts }: { answers: ProfileAnswers; facts: FactValues }) {
  const { t } = useTranslation("communicationProfile");
  const notSet = t("summary.notSet");

  const single = (field: string, value: string | null) =>
    value ? t(`questions.${field}.options.${value}.label`) : notSet;

  const list = (field: string, values: string[], extra?: string) => {
    const labels = values.map((v) => t(`questions.${field}.options.${v}.label`));
    if (extra) labels.push(extra);
    return labels.length ? labels.join(", ") : notSet;
  };

  const words = (Object.keys(answers.preferredWords) as PreferredWordGroup[])
    .map((g) => answers.preferredWords[g])
    .filter(Boolean)
    .map((w) => cap(w as string));

  const answeredFacts = FACT_STEPS.filter((f) => (facts[f.id] ?? "").trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <FieldRow label={t("questions.brandFeel.label")} value={single("brandFeel", answers.brandFeel)} muted={!answers.brandFeel} />
      <FieldRow label={t("questions.formality.label")} value={answers.formality ? t(`questions.formality.scale.${answers.formality}`) : notSet} muted={!answers.formality} />
      <FieldRow label={t("questions.addressForm.label")} value={single("addressForm", answers.addressForm)} muted={!answers.addressForm} />
      <FieldRow label={t("questions.openingStyle.label")} value={single("openingStyle", answers.openingStyle)} muted={!answers.openingStyle} />
      <FieldRow label={t("questions.statusQuestion.label")} value={single("statusQuestion", answers.statusQuestion)} muted={!answers.statusQuestion} />
      <FieldRow label={t("questions.contactApproach.label")} value={single("contactApproach", answers.contactApproach)} muted={!answers.contactApproach} />
      <FieldRow label={t("questions.preferredWords.label")} value={words.length ? words.join(", ") : notSet} muted={!words.length} />
      <FieldRow label={t("questions.distinctive.label")} value={list("distinctive", answers.distinctive, answers.distinctiveOther || undefined)} muted={!answers.distinctive.length && !answers.distinctiveOther} />
      <FieldRow label={t("questions.perception.label")} value={list("perception", answers.perception)} muted={!answers.perception.length} />
      <FieldRow label={t("questions.agentName.label")} value={answers.agentName ? t(`questions.agentName.options.${answers.agentName}.label`) : notSet} muted={!answers.agentName} />
      {answers.agentNameNote && <FieldRow label={t("wizard.optionalNote")} value={answers.agentNameNote} muted />}

      {answeredFacts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <GroupLabel>{t("summary.factsTitle")}</GroupLabel>
          {answeredFacts.map((f) => (
            <FieldRow key={f.id} label={t(`facts.${f.id}.label`)} value={facts[f.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
