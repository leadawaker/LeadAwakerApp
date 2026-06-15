import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  STYLE_STEPS, STEPS_WITH_EXAMPLES, RECOMMENDED_STEPS, recommendFor, EMPTY_ANSWERS,
  FACT_STEPS,
  OPENING_STYLE, ADDRESS_FORM, STATUS_QUESTION, BRAND_FEEL, CONTACT_APPROACH,
  DISTINCTIVE, PERCEPTION, PERCEPTION_MAX, AGENT_NAMES, AGENT_GENDER,
  PREFERRED_WORD_GROUPS, FORMALITY_MIN, FORMALITY_MAX,
  type ProfileAnswers, type WizardStep, type RecommendedStep, type PreferredWordGroup, type FactValues,
} from "./profileConstants";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isRecommended = (f: string): f is RecommendedStep => (RECOMMENDED_STEPS as readonly string[]).includes(f);

// ── Selectable option card ───────────────────────────────────────────────────
function OptionCard({ selected, onClick, children, badge }: { selected: boolean; onClick: () => void; children: ReactNode; badge?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={selected ? "neu-raised" : "neu-inset-crisp"}
      style={{
        textAlign: "left", width: "100%", padding: "13px 15px", borderRadius: "var(--r-button)",
        cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 11, position: "relative",
        border: selected ? "1px solid var(--wine)" : "1px solid transparent",
        background: selected ? "var(--wine-tint)" : "var(--bg)", transition: "background 120ms",
      }}
    >
      <span style={{
        width: 16, height: 16, marginTop: 1, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: selected ? "var(--wine)" : "transparent", boxShadow: selected ? "none" : "var(--sh-inset-crisp)",
        color: "var(--paper)",
      }}>{selected && <Check size={11} strokeWidth={3} />}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {badge}
    </button>
  );
}

// ── Toggle chip (multi-select) ───────────────────────────────────────────────
function Chip({ selected, disabled, onClick, label }: { selected: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      style={{
        padding: "8px 14px", borderRadius: "var(--r-pill)", fontSize: 12.5, cursor: disabled && !selected ? "not-allowed" : "pointer",
        border: selected ? "1px solid var(--wine)" : "1px solid transparent",
        background: selected ? "var(--wine-tint)" : "var(--bg)",
        color: selected ? "var(--wine)" : disabled ? "var(--mute-2)" : "var(--ink-soft)",
        boxShadow: selected ? "none" : "var(--sh-inset-crisp)", fontWeight: selected ? 600 : 400,
        opacity: disabled && !selected ? 0.5 : 1, transition: "background 120ms",
      }}
    >{label}</button>
  );
}

function RecommendedBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--wine)", background: "var(--wine-tint)", padding: "3px 8px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

interface Props {
  initial?: ProfileAnswers;
  initialFacts?: FactValues;
  saving: boolean;
  onFinish: (answers: ProfileAnswers, facts: FactValues) => void;
  // When set, the question area scrolls within this max height instead of
  // filling the parent (used inline in the ultra-wide overview).
  bodyMaxHeight?: number;
}

export function ProfileWizard({ initial, initialFacts, saving, onFinish, bodyMaxHeight }: Props) {
  const { t } = useTranslation("communicationProfile");
  const [step, setStep] = useState(0);
  const [a, setA] = useState<ProfileAnswers>(initial ?? { ...EMPTY_ANSWERS });
  const [facts, setFacts] = useState<FactValues>(initialFacts ?? {});

  const styleCount = STYLE_STEPS.length;
  const total = styleCount + FACT_STEPS.length;
  const isStyle = step < styleCount;
  const field = isStyle ? (STYLE_STEPS[step] as WizardStep) : null;
  const fact = isStyle ? null : FACT_STEPS[step - styleCount];
  const isLast = step === total - 1;
  const set = (patch: Partial<ProfileAnswers>) => setA((prev) => ({ ...prev, ...patch }));

  // Pre-select the expert recommendation when first landing on a tactical step.
  useEffect(() => {
    if (field && isRecommended(field) && a[field] == null) {
      setA((prev) => ({ ...prev, [field]: recommendFor(field, prev.brandFeel) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggleArray = (key: "distinctive" | "perception", value: string, max?: number) => {
    const cur = a[key];
    if (cur.includes(value)) set({ [key]: cur.filter((v) => v !== value) } as any);
    else if (!max || cur.length < max) set({ [key]: [...cur, value] } as any);
  };

  function renderStyle(f: WizardStep) {
    switch (f) {
      case "openingStyle":
        return <SingleChoice field={f} options={OPENING_STYLE} value={a.openingStyle} onSelect={(v) => set({ openingStyle: v })} />;
      case "addressForm":
        return <SingleChoice field={f} options={ADDRESS_FORM} value={a.addressForm} onSelect={(v) => set({ addressForm: v })} />;
      case "statusQuestion":
        return <SingleChoice field={f} options={STATUS_QUESTION} value={a.statusQuestion} onSelect={(v) => set({ statusQuestion: v })} />;
      case "brandFeel":
        return <SingleChoice field={f} options={BRAND_FEEL} value={a.brandFeel} onSelect={(v) => set({ brandFeel: v })} />;
      case "contactApproach":
        return <SingleChoice field={f} options={CONTACT_APPROACH} value={a.contactApproach} onSelect={(v) => set({ contactApproach: v })} />;
      case "distinctive":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {DISTINCTIVE.map((k) => (
              <Chip key={k} selected={a.distinctive.includes(k)} onClick={() => toggleArray("distinctive", k)} label={t(`questions.distinctive.options.${k}.label`)} />
            ))}
            <input
              value={a.distinctiveOther}
              onChange={(e) => set({ distinctiveOther: e.target.value })}
              placeholder={t("wizard.otherPlaceholder")}
              className="neu-inset-crisp"
              style={{ flex: "1 1 100%", marginTop: 6, padding: "9px 13px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}
            />
          </div>
        );
      case "preferredWords":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(Object.keys(PREFERRED_WORD_GROUPS) as PreferredWordGroup[]).map((group) => (
              <div key={group}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t(`questions.preferredWords.groups.${group}`)}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                  {PREFERRED_WORD_GROUPS[group].map((word) => (
                    <Chip
                      key={word}
                      selected={a.preferredWords[group] === word}
                      onClick={() => set({ preferredWords: { ...a.preferredWords, [group]: a.preferredWords[group] === word ? undefined : word } })}
                      label={cap(word)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      case "formality":
        return (
          <div style={{ display: "flex", gap: 9 }}>
            {Array.from({ length: FORMALITY_MAX - FORMALITY_MIN + 1 }, (_, i) => i + FORMALITY_MIN).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set({ formality: n })}
                className={a.formality === n ? "neu-raised" : "neu-inset-crisp"}
                style={{
                  flex: 1, padding: "12px 6px", borderRadius: "var(--r-button)", cursor: "pointer",
                  border: a.formality === n ? "1px solid var(--wine)" : "1px solid transparent",
                  background: a.formality === n ? "var(--wine-tint)" : "var(--bg)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}
              >
                <span className="serif" style={{ fontSize: 20, color: a.formality === n ? "var(--wine)" : "var(--ink)", lineHeight: 1 }}>{n}</span>
                <span style={{ fontSize: 10, color: "var(--mute)", textAlign: "center", lineHeight: 1.2 }}>{t(`questions.formality.scale.${n}`)}</span>
              </button>
            ))}
          </div>
        );
      case "perception": {
        const full = a.perception.length >= PERCEPTION_MAX;
        return (
          <div>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10, color: "var(--mute-2)" }}>{t("wizard.selectUpTo", { max: PERCEPTION_MAX })} · {a.perception.length}/{PERCEPTION_MAX}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {PERCEPTION.map((k) => (
                <Chip key={k} selected={a.perception.includes(k)} disabled={full} onClick={() => toggleArray("perception", k, PERCEPTION_MAX)} label={t(`questions.perception.options.${k}.label`)} />
              ))}
            </div>
          </div>
        );
      }
      case "agentName":
        return (
          <div>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 16px", lineHeight: 1.5 }}>{t("questions.agentName.help")}</p>
            {(["male", "female"] as const).map((gender) => (
              <div key={gender} style={{ marginBottom: 14 }}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t(`questions.agentName.${gender}`)}</div>
                <div style={{ display: "flex", gap: 9 }}>
                  {AGENT_NAMES.filter((n) => AGENT_GENDER[n] === gender).map((n) => (
                    <OptionCard key={n} selected={a.agentName === n} onClick={() => set({ agentName: n })}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>{t(`questions.agentName.options.${n}.label`)}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>
            ))}
            <input
              value={a.agentNameNote}
              onChange={(e) => set({ agentNameNote: e.target.value })}
              placeholder={t("questions.agentName.notePlaceholder")}
              className="neu-inset-crisp"
              style={{ width: "100%", marginTop: 4, padding: "9px 13px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)" }}
            />
          </div>
        );
    }
  }

  // Single-choice block factored so example sentences + the recommendation badge
  // render uniformly.
  function SingleChoice({ field, options, value, onSelect }: {
    field: WizardStep; options: readonly string[]; value: string | null; onSelect: (v: string) => void;
  }) {
    const withExample = STEPS_WITH_EXAMPLES.includes(field);
    const rec = isRecommended(field) ? recommendFor(field, a.brandFeel) : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((k) => (
          <OptionCard
            key={k}
            selected={value === k}
            onClick={() => onSelect(k)}
            badge={rec === k ? <RecommendedBadge label={t("wizard.recommended")} /> : undefined}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.${field}.options.${k}.label`)}</span>
            {withExample && (
              <span style={{ display: "block", fontSize: 12, color: "var(--mute)", fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>
                "{t(`questions.${field}.options.${k}.example`)}"
              </span>
            )}
          </OptionCard>
        ))}
      </div>
    );
  }

  function renderFact() {
    if (!fact) return null;
    return (
      <div>
        <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t(`facts.${fact.id}.help`)}</p>
        <textarea
          value={facts[fact.id] ?? ""}
          onChange={(e) => setFacts((prev) => ({ ...prev, [fact.id]: e.target.value }))}
          placeholder={t("facts.placeholder")}
          rows={6}
          className="neu-inset-crisp"
          style={{ width: "100%", padding: "11px 13px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)", resize: "vertical", lineHeight: 1.5 }}
        />
      </div>
    );
  }

  const phaseLabel = isStyle ? t("wizard.phaseCommunication") : t("wizard.phaseFacts");
  const questionLabel = isStyle ? t(`questions.${field}.label`) : t(`facts.${fact!.id}.label`);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: bodyMaxHeight ? "auto" : "100%", minHeight: 0 }}>
      {/* Progress */}
      <div style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <span className="eyebrow eyebrow-sm" style={{ color: "var(--wine)" }}>{phaseLabel}</span>
          <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>{t("wizard.stepLabel", { current: step + 1, total })}</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((step + 1) / total) * 100}%`, background: "var(--wine)", borderRadius: 999, transition: "width 200ms" }} />
        </div>
      </div>

      {/* Question */}
      <h4 className="serif" style={{ margin: "0 0 16px", fontSize: 19, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
        {questionLabel}
      </h4>

      <div style={{ flex: bodyMaxHeight ? undefined : 1, minHeight: 0, maxHeight: bodyMaxHeight, overflowY: "auto", paddingRight: 4 }}>
        {isStyle ? renderStyle(field!) : renderFact()}
      </div>

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <button className="la-btn la-btn--soft" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft size={14} />{t("wizard.back")}
        </button>
        {isLast ? (
          <button className="la-btn la-btn--wine" onClick={() => onFinish(a, facts)} disabled={saving}>
            <Check size={14} />{saving ? t("wizard.saving") : t("wizard.finish")}
          </button>
        ) : (
          <button className="la-btn la-btn--wine" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
            {t("wizard.next")}<ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
