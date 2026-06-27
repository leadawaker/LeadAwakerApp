import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Check, Plus, X } from "lucide-react";
import {
  STEPS, STEPS_WITH_EXAMPLES, addressFor, EMPTY_ANSWERS, QA_MIN_ROWS,
  AI_STYLE, FORMALITY_LEVELS, PERCEPTION, PERCEPTION_MAX,
  AGENT_NAMES, AGENT_GENDER, AVATAR_CHOICES, AGENT_AVATAR_URL, effectiveGender, QA_CATEGORY,
  FACTS_WITH_NOPE, SECTIONS, isRecommended,
  type ProfileAnswers, type StyleField, type PreferredWordGroup, type FactValues, type QARow,
} from "./profileConstants";
import type { QAGrids } from "./useOnboardingFacts";
import { useNicheWords } from "./useNicheWords";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { USP_OPTIONS, asCampaignLang } from "@/features/campaigns/components/settings/fieldLocale";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Same niche list as the campaign settings dropdown and the vocabulary manager,
// so the suggested words stay in sync across the app.
const WIZARD_NICHE_OPTIONS = [
  "Kitchens", "Bathrooms", "Countertops", "Flooring", "General Contracting",
  "Solar Panels", "HVAC", "Roofing", "Landscaping", "Windows & Doors",
  "Painting", "Pest Control", "Pool Installation", "Moving Services",
];

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
        padding: "8px 14px", borderRadius: "var(--r-pill)", fontSize: 13.5, cursor: disabled && !selected ? "not-allowed" : "pointer",
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
  width: "100%", padding: "9px 13px", borderRadius: "var(--r-button)", fontSize: 14,
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
  niche?: string | null;
  accountName?: string;
  accountLogoUrl?: string | null;
  showPreview?: boolean;
  prefillWords?: boolean;
  onFinish: (answers: ProfileAnswers, facts: FactValues, grids: QAGrids) => void;
  onClose?: (answers: ProfileAnswers, facts: FactValues, grids: QAGrids) => void;
  bodyMaxHeight?: number;
}

export function ProfileWizard({ initial, initialFacts, initialGrids, initialStep, saving, niche, accountName, accountLogoUrl, showPreview, prefillWords, onFinish, onClose, bodyMaxHeight }: Props) {
  const { t, i18n } = useTranslation("communicationProfile");
  const [step, setStep] = useState(initialStep ?? 0);
  const [a, setA] = useState<ProfileAnswers>(initial ?? { ...EMPTY_ANSWERS });
  const [facts, setFacts] = useState<FactValues>(initialFacts ?? {});
  const [grids, setGrids] = useState<QAGrids>(() => {
    const g: QAGrids = {};
    for (const key of Object.keys(QA_CATEGORY)) g[key] = padRows(initialGrids?.[key]);
    return g;
  });
  const [newWordInputs, setNewWordInputs] = useState<Partial<Record<PreferredWordGroup, string>>>({});
  // Operator can override the niche on the preferred-words step to re-theme the
  // suggested vocabulary, independent of the account's stored niche.
  const [activeNiche, setActiveNiche] = useState<string | null | undefined>(niche);
  useEffect(() => { setActiveNiche(niche); }, [niche]);
  const nicheWords = useNicheWords(activeNiche);

  // For a NEW profile, default each preferred-word group to the first chip of the
  // account's niche vocabulary once it loads (only if still unset — never clobber).
  useEffect(() => {
    if (!prefillWords) return;
    setA((prev) => {
      const pw = { ...prev.preferredWords };
      let changed = false;
      (["projectTerm", "proposalTerm", "decisionTerm"] as PreferredWordGroup[]).forEach((g) => {
        const first = nicheWords.groups[g]?.[0];
        if (!pw[g] && first) { pw[g] = first; changed = true; }
      });
      return changed ? { ...prev, preferredWords: pw } : prev;
    });
  }, [prefillWords, nicheWords.groups]);

  const total = STEPS.length;
  const def = STEPS[step];
  const isLast = step === total - 1;

  // Section (chapter) progress for the header + segmented bar.
  const currentSection = def.section;
  const sectionIndex = SECTIONS.indexOf(currentSection);
  const posInSection = STEPS.slice(0, step + 1).filter((s) => s.section === currentSection).length;
  const set = (patch: Partial<ProfileAnswers>) => setA((prev) => ({ ...prev, ...patch }));

  // Progressive WhatsApp preview: reveal balloons as the call advances rather than
  // showing the whole sample up front. By the start of part 2 (identity) all 5 show.
  const PREVIEW_REVEAL: Record<string, number> = { openingStyle: 2, formality: 3, perception: 3 };
  const previewCount = PREVIEW_REVEAL[def.key] ?? 5;

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
      case "formality":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FORMALITY_LEVELS.map((lvl) => (
              <OptionCard
                key={lvl.key}
                selected={a.formality === lvl.value}
                onClick={() => set({ formality: lvl.value, addressForm: addressFor(lvl.value) })}
                badge={
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {isRecommended("formality", lvl.key) && <RecommendedBadge label={t("wizard.recommended")} />}
                    <RecommendedBadge label={lvl.address === "u" ? "U" : "Je"} />
                  </span>
                }
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.formality.levels.${lvl.key}.label`)}</span>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
              {PERCEPTION.map((k) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Chip selected={a.perception.includes(k)} disabled={full} onClick={() => togglePerception(k)} label={t(`questions.perception.options.${k}.label`)} />
                  {isRecommended("perception", k) && <RecommendedBadge label={t("wizard.recommended")} />}
                </span>
              ))}
            </div>
          </div>
        );
      }
      case "preferredWords":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Niche selector — re-themes the suggested words to the client's trade */}
            <div>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t("questions.preferredWords.nicheLabel")}</div>
              <select
                value={activeNiche ?? ""}
                onChange={(e) => setActiveNiche(e.target.value || null)}
                style={{
                  padding: "7px 10px", fontSize: 13, borderRadius: "var(--r-button)",
                  border: "1px solid var(--line)", background: "transparent", color: "var(--ink-soft)",
                }}
              >
                <option value="">{t("questions.preferredWords.nicheDefault")}</option>
                {WIZARD_NICHE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {(["projectTerm", "proposalTerm", "decisionTerm"] as PreferredWordGroup[]).map((group) => {
              const words = nicheWords.groups[group] ?? [];
              const newWord = newWordInputs[group] ?? "";
              return (
                <div key={group}>
                  <div className="eyebrow eyebrow-sm" style={{ marginBottom: 8 }}>{t(`questions.preferredWords.groups.${group}`)}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                    {words.map((word) => (
                      <Chip
                        key={word}
                        selected={a.preferredWords[group] === word}
                        onClick={() => set({ preferredWords: { ...a.preferredWords, [group]: a.preferredWords[group] === word ? undefined : word } })}
                        label={cap(word)}
                      />
                    ))}
                    {/* Inline add word */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        value={newWord}
                        onChange={(e) => setNewWordInputs((p) => ({ ...p, [group]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newWord.trim()) {
                            e.preventDefault();
                            nicheWords.addWord(group, newWord).then(() => {
                              set({ preferredWords: { ...a.preferredWords, [group]: newWord.trim() } });
                              setNewWordInputs((p) => ({ ...p, [group]: "" }));
                            });
                          }
                        }}
                        placeholder="+ voeg toe"
                        style={{
                          width: 110, padding: "7px 10px", fontSize: 12, borderRadius: "var(--r-button)",
                          border: "1px solid var(--line)", background: "transparent", color: "var(--ink-soft)",
                        }}
                      />
                      {newWord.trim() && (
                        <button
                          type="button"
                          className="la-btn la-btn--wine"
                          style={{ padding: "5px 10px", fontSize: 12 }}
                          disabled={nicheWords.adding}
                          onClick={() => {
                            nicheWords.addWord(group, newWord).then(() => {
                              set({ preferredWords: { ...a.preferredWords, [group]: newWord.trim() } });
                              setNewWordInputs((p) => ({ ...p, [group]: "" }));
                            });
                          }}
                        >
                          <Plus size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
                    <OptionCard key={n} selected={a.agentName === n && !a.agentNameCustom} onClick={() => set({ agentName: n, agentNameCustom: "" })} badge={isRecommended("agentName", n) ? <RecommendedBadge label={t("wizard.recommended")} /> : undefined}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)" }}>{t(`questions.agentName.options.${n}.label`)}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
              <input
                value={a.agentNameCustom}
                onChange={(e) => set({ agentNameCustom: e.target.value, agentName: e.target.value ? null : a.agentName })}
                placeholder={t("questions.agentName.customPlaceholder")}
                className="neu-inset-crisp"
                style={{ ...inputStyle, flex: 1 }}
              />
              {a.agentNameCustom.trim() && (
                <button
                  type="button"
                  className="la-btn la-btn--soft la-btn--icon"
                  title={t("questions.agentName.toggleGender")}
                  onClick={() => set({ avatarGender: effectiveGender(a) === "male" ? "female" : "male" })}
                  style={{ width: 38, height: 38, padding: 0, flexShrink: 0, overflow: "hidden" }}
                >
                  <img src={AGENT_AVATAR_URL[effectiveGender(a)]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                </button>
              )}
            </div>
            <div className="eyebrow eyebrow-sm" style={{ margin: "18px 0 8px" }}>{t("questions.agentName.avatarLabel")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {AVATAR_CHOICES.map((c) => (
                <OptionCard key={c} selected={a.avatarChoice === c} onClick={() => set({ avatarChoice: c })} badge={isRecommended("avatarChoice", c) ? <RecommendedBadge label={t("wizard.recommended")} /> : undefined}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.agentName.avatar.${c}.label`)}</span>
                  <span style={{ fontSize: 11.5, color: "var(--mute)", display: "block", marginTop: 3 }}>{t(`questions.agentName.avatar.${c}.help`)}</span>
                </OptionCard>
              ))}
            </div>
          </div>
        );
      case "differentiator": {
        const rows = a.differentiator.length ? a.differentiator.split("\n") : [""];
        const setRows = (next: string[]) => set({ differentiator: next.join("\n") });
        // Examples = the campaign USP dropdown options (shared source of truth).
        const uspLang = asCampaignLang(i18n.language);
        const examples = (USP_OPTIONS[uspLang] ?? USP_OPTIONS.en).filter(Boolean);
        return (
          <div>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t("questions.differentiator.help")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={row}
                    onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? e.target.value : r)))}
                    className="neu-inset-crisp"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                      className="la-btn la-btn--soft la-btn--icon"
                      title={t("questions.differentiator.remove")}
                      style={{ width: 34, height: 34, flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="la-btn la-btn--inset" style={{ marginTop: 12 }} onClick={() => setRows([...rows, ""])}>
              <Plus size={13} />{t("questions.differentiator.add")}
            </button>
            {examples.length > 0 && (
              <div style={{ marginTop: 18, background: "var(--paper)", borderRadius: "var(--r-button)", padding: "13px 15px" }}>
                <div className="eyebrow eyebrow-sm" style={{ marginBottom: 9, color: "var(--mute-2)" }}>{t("questions.differentiator.examplesLabel")}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                  {examples.map((ex, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--wine)" }}>·</span>{ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
      case "bookingUrl":
        return (
          <div>
            <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t("questions.bookingUrl.help")}</p>
            <input
              type="url"
              value={a.bookingUrl}
              onChange={(e) => set({ bookingUrl: e.target.value })}
              placeholder={t("questions.bookingUrl.placeholder")}
              className="neu-inset-crisp"
              style={inputStyle}
            />
          </div>
        );
    }
  }

  function SingleChoice({ field, options, value, onSelect, withBehavior }: {
    field: StyleField; options: readonly string[]; value: string | null; onSelect: (v: string) => void; withBehavior?: boolean;
  }) {
    const withExample = STEPS_WITH_EXAMPLES.includes(field);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((k) => (
          <OptionCard key={k} selected={value === k} onClick={() => onSelect(k)} badge={isRecommended(field, k) ? <RecommendedBadge label={t("wizard.recommended")} /> : undefined}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", display: "block" }}>{t(`questions.${field}.options.${k}.label`)}</span>
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
    const hasNope = FACTS_WITH_NOPE.includes(key);
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
        {hasNope && (
          <button
            type="button"
            className="la-btn la-btn--soft"
            style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => {
              setFacts((prev) => ({ ...prev, [key]: t(`facts.${key}.negative`) }));
              setStep((s) => Math.min(total - 1, s + 1));
            }}
          >
            {t("wizard.nope")}
          </button>
        )}
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
            <div key={i} className="neu-inset-crisp" style={{ borderRadius: "var(--r-button)", overflow: "hidden", position: "relative" }}>
              <input
                value={row.question}
                onChange={(e) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, question: e.target.value } : r))}
                placeholder={t(`questions.${stepKey}.questionPlaceholder`, { n: i + 1 })}
                style={{ ...inputStyle, borderRadius: 0, borderBottom: "1px solid var(--line)" }}
              />
              <input
                value={row.answer}
                onChange={(e) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, answer: e.target.value } : r))}
                placeholder={t(`questions.${stepKey}.answerPlaceholder`, { n: i + 1 })}
                style={{ ...inputStyle, borderRadius: 0 }}
              />
              <button
                type="button"
                onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                className="la-btn la-btn--soft la-btn--icon"
                title={t(`questions.${stepKey}.remove`)}
                style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22 }}
              >
                <X size={12} />
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

  const progressHeader = (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <div className="eyebrow eyebrow-sm" style={{ color: "var(--wine)" }}>{t(`sections.${currentSection}`)}</div>
            <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>{sectionIndex + 1}/{SECTIONS.length}</div>
          </div>
          <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>
            {t("wizard.stepLabel", { current: step + 1, total })}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="la-btn la-btn--soft la-btn--icon"
            title={t("wizard.saveDraft")}
            style={{ width: 26, height: 26, flexShrink: 0 }}
            onClick={() => onClose(a, facts, grids)}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {SECTIONS.map((sec, i) => {
          const count = STEPS.filter((s) => s.section === sec).length;
          const fill = i < sectionIndex ? 1 : i === sectionIndex ? posInSection / count : 0;
          return (
            <div key={sec} style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${fill * 100}%`, background: "var(--wine)", borderRadius: 999, transition: "width 200ms" }} />
            </div>
          );
        })}
      </div>
    </div>
  );

  const stepBody = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Question */}
      <h4 className="serif" style={{ margin: "0 0 16px", fontSize: 21, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
        {questionLabel}
      </h4>

      <div style={{ flex: bodyMaxHeight ? undefined : 1, minHeight: 0, maxHeight: bodyMaxHeight, overflowY: "auto", paddingLeft: 6, paddingRight: 6 }}>
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

  // The WhatsApp preview only adds value while the tone + identity answers shape the
  // sample conversation. From the sales section on (differentiator etc.) it's hidden
  // and the question column goes full width.
  const previewVisible = showPreview && (currentSection === "tone" || currentSection === "identity");

  if (previewVisible) {
    // Progress bar spans the full width, above both the question column and the preview.
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        {progressHeader}
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 40, flex: 1, minHeight: 0 }}>
          <div style={{ minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{stepBody}</div>
          <div style={{ minHeight: 0 }}><WhatsAppPreview answers={a} accountName={accountName} accountLogoUrl={accountLogoUrl} visibleCount={previewCount} /></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: bodyMaxHeight ? "auto" : "100%", minHeight: 0 }}>
      {progressHeader}
      {stepBody}
    </div>
  );
}
