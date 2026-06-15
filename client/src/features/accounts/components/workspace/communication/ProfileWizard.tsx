import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Check, Plus, X } from "lucide-react";
import {
  STEPS, STEPS_WITH_EXAMPLES, recommendStatus, addressFor, EMPTY_ANSWERS, QA_MIN_ROWS,
  AI_STYLE, STATUS_QUESTION, FORMALITY_LEVELS, PERCEPTION, PERCEPTION_MAX,
  AGENT_NAMES, AGENT_GENDER, AVATAR_CHOICES, PREFERRED_WORD_GROUPS, QA_CATEGORY,
  type ProfileAnswers, type StyleField, type PreferredWordGroup, type FactValues, type QARow,
} from "./profileConstants";
import type { QAGrids } from "./useOnboardingFacts";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

const inputStyle = {
  width: "100%", padding: "9px 13px", borderRadius: "var(--r-button)", fontSize: 13,
  border: "none", background: "var(--bg)", color: "var(--ink-soft)",
} as const;

function padRows(rows?: QARow[]): QARow[] {
  const out = [...(rows ?? [])];
  while (out.length < QA_MIN_ROWS) out.push({ question: "", answer: "" });
  return out;
}

interface Props {
  initial?: ProfileAnswers;
  initialFacts?: FactValues;
  initialGrids?: QAGrids;
  initialStep?: number;
  saving: boolean;
  onFinish: (answers: ProfileAnswers, facts: FactValues, grids: QAGrids) => void;
  bodyMaxHeight?: number;
}

export function ProfileWizard({ initial, initialFacts, initialGrids, initialStep, saving, onFinish, bodyMaxHeight }: Props) {
  const { t } = useTranslation("communicationProfile");
  const [step, setStep] = useState(initialStep ?? 0);
  const [a, setA] = useState<ProfileAnswers>(initial ?? { ...EMPTY_ANSWERS });
  const [facts, setFacts] = useState<FactValues>(initialFacts ?? {});
  const [grids, setGrids] = useState<QAGrids>(() => {
    const g: QAGrids = {};
    for (const key of Object.keys(QA_CATEGORY)) g[key] = padRows(initialGrids?.[key]);
    return g;
  });

  const total = STEPS.length;
  const def = STEPS[step];
  const isLast = step === total - 1;
  const set = (patch: Partial<ProfileAnswers>) => setA((prev) => ({ ...prev, ...patch }));

  // Pre-select the recommended status question (derived from AI style) on arrival.
  useEffect(() => {
    if (def.key === "statusQuestion" && a.statusQuestion == null) {
      setA((prev) => ({ ...prev, statusQuestion: recommendStatus(prev.openingStyle) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const togglePerception = (value: string) => setA((prev) => {
    const cur = prev.perception;
    if (cur.includes(value)) return { ...prev, perception: cur.filter((v) => v !== value) };
    if (cur.length < PERCEPTION_MAX) return { ...prev, perception: [...cur, value] };
    return prev;
  });

  function renderStyle(f: StyleField) {
    switch (f) {
      case "openingStyle":
        return <SingleChoice field="openingStyle" options={AI_STYLE} value={a.openingStyle} onSelect={(v) => set({ openingStyle: v })} withBehavior />;
      case "statusQuestion":
        return <SingleChoice field="statusQuestion" options={STATUS_QUESTION} value={a.statusQuestion} onSelect={(v) => set({ statusQuestion: v })} />;
      case "formality":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FORMALITY_LEVELS.map((lvl) => (
              <OptionCard
                key={lvl.key}
                selected={a.formality === lvl.value}
                onClick={() => set({ formality: lvl.value, addressForm: addressFor(lvl.value) })}
                badge={<RecommendedBadge label={lvl.address === "u" ? "U" : "Je"} />}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.formality.levels.${lvl.key}.label`)}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--mute)", fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>"{t(`questions.formality.levels.${lvl.key}.example`)}"</span>
              </OptionCard>
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
                <Chip key={k} selected={a.perception.includes(k)} disabled={full} onClick={() => togglePerception(k)} label={t(`questions.perception.options.${k}.label`)} />
              ))}
            </div>
          </div>
        );
      }
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
      case "agentName":
        return (
          <div>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 16px", lineHeight: 1.5 }}>{t("questions.agentName.help")}</p>
            {(["male", "female"] as const).map((gender) => (
              <div key={gender} style={{ marginBottom: 12 }}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t(`questions.agentName.${gender}`)}</div>
                <div style={{ display: "flex", gap: 9 }}>
                  {AGENT_NAMES.filter((n) => AGENT_GENDER[n] === gender).map((n) => (
                    <OptionCard key={n} selected={a.agentName === n && !a.agentNameCustom} onClick={() => set({ agentName: n, agentNameCustom: "" })}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>{t(`questions.agentName.options.${n}.label`)}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>
            ))}
            <input
              value={a.agentNameCustom}
              onChange={(e) => set({ agentNameCustom: e.target.value, agentName: e.target.value ? null : a.agentName })}
              placeholder={t("questions.agentName.customPlaceholder")}
              className="neu-inset-crisp"
              style={{ ...inputStyle, marginTop: 2 }}
            />
            <div className="eyebrow eyebrow-sm" style={{ margin: "18px 0 8px" }}>{t("questions.agentName.avatarLabel")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {AVATAR_CHOICES.map((c) => (
                <OptionCard key={c} selected={a.avatarChoice === c} onClick={() => set({ avatarChoice: c })}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.agentName.avatar.${c}.label`)}</span>
                  <span style={{ fontSize: 11.5, color: "var(--mute)", display: "block", marginTop: 3 }}>{t(`questions.agentName.avatar.${c}.help`)}</span>
                </OptionCard>
              ))}
            </div>
          </div>
        );
    }
  }

  function SingleChoice({ field, options, value, onSelect, withBehavior }: {
    field: StyleField; options: readonly string[]; value: string | null; onSelect: (v: string) => void; withBehavior?: boolean;
  }) {
    const withExample = STEPS_WITH_EXAMPLES.includes(field);
    const rec = field === "statusQuestion" ? recommendStatus(a.openingStyle) : null;
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
            {withBehavior && (
              <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>{t(`questions.${field}.options.${k}.behavior`)}</span>
            )}
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

  function renderFact(key: string) {
    return (
      <div>
        <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t(`facts.${key}.help`)}</p>
        <textarea
          value={facts[key] ?? ""}
          onChange={(e) => setFacts((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={t("facts.placeholder")}
          rows={6}
          className="neu-inset-crisp"
          style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
        />
      </div>
    );
  }

  function renderGrid(stepKey: string) {
    const rows = grids[stepKey] ?? [];
    const setRows = (updater: (prev: QARow[]) => QARow[]) =>
      setGrids((prev) => ({ ...prev, [stepKey]: updater(prev[stepKey] ?? []) }));
    return (
      <div>
        <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t(`questions.${stepKey}.help`)}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "start" }}>
              <input value={row.question} onChange={(e) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, question: e.target.value } : r))} placeholder={t(`questions.${stepKey}.questionPlaceholder`)} className="neu-inset-crisp" style={inputStyle} />
              <input value={row.answer} onChange={(e) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, answer: e.target.value } : r))} placeholder={t(`questions.${stepKey}.answerPlaceholder`)} className="neu-inset-crisp" style={inputStyle} />
              <button type="button" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="la-btn la-btn--soft la-btn--icon" title={t(`questions.${stepKey}.remove`)} style={{ marginTop: 1 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="la-btn la-btn--inset" style={{ marginTop: 12 }} onClick={() => setRows((p) => [...p, { question: "", answer: "" }])}>
          <Plus size={13} />{t(`questions.${stepKey}.add`)}
        </button>
      </div>
    );
  }

  const questionLabel = def.kind === "fact" ? t(`facts.${def.key}.label`) : t(`questions.${def.key}.label`);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: bodyMaxHeight ? "auto" : "100%", minHeight: 0 }}>
      {/* Progress */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)", marginBottom: 8 }}>{t("wizard.stepLabel", { current: step + 1, total })}</div>
        <div style={{ height: 4, borderRadius: 999, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((step + 1) / total) * 100}%`, background: "var(--wine)", borderRadius: 999, transition: "width 200ms" }} />
        </div>
      </div>

      {/* Question */}
      <h4 className="serif" style={{ margin: "0 0 16px", fontSize: 19, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
        {questionLabel}
      </h4>

      <div style={{ flex: bodyMaxHeight ? undefined : 1, minHeight: 0, maxHeight: bodyMaxHeight, overflowY: "auto", paddingRight: 4 }}>
        {def.kind === "style" && renderStyle(def.key as StyleField)}
        {def.kind === "fact" && renderFact(def.key)}
        {def.kind === "qagrid" && renderGrid(def.key)}
      </div>

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <button className="la-btn la-btn--soft" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft size={14} />{t("wizard.back")}
        </button>
        {isLast ? (
          <button className="la-btn la-btn--wine" onClick={() => onFinish(a, facts, grids)} disabled={saving}>
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
