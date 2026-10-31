import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Check, Plus, X } from "lucide-react";
import {
  buildSteps, buildPages, buildSections, addressFor, EMPTY_ANSWERS, QA_MIN_ROWS,
  FORMALITY_LEVELS, PERCEPTION, PERCEPTION_MAX,
  AGENT_NAMES, AGENT_GENDER, QA_CATEGORY,
  FACTS_WITH_NOPE, isRecommended,
  type ProfileAnswers, type StepDef, type StyleField, type FactValues, type QARow,
} from "./profileConstants";
import type { QAGrids } from "./useOnboardingFacts";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { OptionCard, Chip, RecommendedBadge, inputStyle } from "./wizardAtoms";
import { ServiceStep } from "./ServiceSteps";
import { USP_OPTIONS, asCampaignLang } from "@/features/campaigns/components/settings/fieldLocale";
import { MeetingTypeCard } from "../MeetingTypeCard";
import { AvailabilityCard } from "../AvailabilityCard";
import type { AccountRow, AccountDetail } from "../types";
import type { ReceptionistSetup } from "./setupConstants";

function padRows(rows?: QARow[]): QARow[] {
  const out = [...(rows ?? [])];
  while (out.length < QA_MIN_ROWS) out.push({ question: "", answer: "" });
  return out;
}

interface Props {
  accountId?: number;
  initial?: ProfileAnswers;
  initialFacts?: FactValues;
  initialGrids?: QAGrids;
  initialStep?: number;
  saving: boolean;
  accountName?: string;
  accountLogoUrl?: string | null;
  showPreview?: boolean;
  onFinish: (answers: ProfileAnswers, facts: FactValues, grids: QAGrids) => void;
  onClose?: (answers: ProfileAnswers, facts: FactValues, grids: QAGrids) => void;
  bodyMaxHeight?: number;
  // The account row + detail + PATCH callback, for the steps that embed the
  // Integrations cards (WhatsApp signup, inbound campaign). Optional: without
  // them those steps point to the Integrations tab instead.
  account?: AccountRow;
  detail?: AccountDetail;
  onSaveAccount?: (field: string, value: string) => Promise<void>;
}

export function ProfileWizard({ accountId, initial, initialFacts, initialGrids, initialStep, saving, accountName, accountLogoUrl, showPreview, onFinish, onClose, bodyMaxHeight, account, detail, onSaveAccount }: Props) {
  const { t, i18n } = useTranslation("communicationProfile");
  // `step` counts pages; initialStep comes from the summary, which counts steps.
  const [step, setStep] = useState(() => {
    const allSteps = buildSteps((initial ?? EMPTY_ANSWERS).services);
    const target = allSteps[initialStep ?? 0];
    return Math.max(0, buildPages(allSteps).findIndex((p) => p.some((s) => s.key === target?.key)));
  });
  const [a, setA] = useState<ProfileAnswers>(initial ?? { ...EMPTY_ANSWERS });
  const [facts, setFacts] = useState<FactValues>(initialFacts ?? {});
  const [grids, setGrids] = useState<QAGrids>(() => {
    const g: QAGrids = {};
    for (const key of Object.keys(QA_CATEGORY)) g[key] = padRows(initialGrids?.[key]);
    return g;
  });
  // The ticked services decide which sections exist (setupConstants).
  const steps = useMemo(() => buildSteps(a.services), [a.services]);
  const sections = useMemo(() => buildSections(steps), [steps]);
  const pages = useMemo(() => buildPages(steps), [steps]);
  const total = pages.length;
  const page = pages[Math.min(step, total - 1)];
  const def = page[0];
  const isLast = step >= total - 1;

  // Section (chapter) progress for the header + segmented bar.
  const currentSection = def.section;
  const sectionIndex = sections.indexOf(currentSection);
  const posInSection = pages.slice(0, step + 1).filter((p) => p[0].section === currentSection).length;
  const set = (patch: Partial<ProfileAnswers>) => setA((prev) => ({ ...prev, ...patch }));
  const setSetup = <K extends keyof ReceptionistSetup>(part: K, patch: Partial<ReceptionistSetup[K]>) =>
    setA((prev) => ({ ...prev, setup: { ...prev.setup, [part]: { ...prev.setup[part], ...patch } } }));

  // Progressive WhatsApp preview: reveal balloons as the call advances rather than
  // showing the whole sample up front. By the start of part 2 (identity) all 5 show.
  const PREVIEW_REVEAL: Record<string, number> = { formality: 3, perception: 3 };
  const previewCount = PREVIEW_REVEAL[def.key] ?? 5;

  const togglePerception = (value: string) => setA((prev) => {
    const cur = prev.perception;
    if (cur.includes(value)) return { ...prev, perception: cur.filter((v) => v !== value) };
    if (cur.length < PERCEPTION_MAX) return { ...prev, perception: [...cur, value] };
    return prev;
  });

  function renderStyle(f: StyleField) {
    switch (f) {
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

  function renderFact(key: string) {
    const hasNope = FACTS_WITH_NOPE.includes(key);
    return (
      <div>
        <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 12px", lineHeight: 1.5 }}>{t(`facts.${key}.help`)}</p>
        <textarea
          value={facts[key] ?? ""}
          onChange={(e) => setFacts((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={t("facts.placeholder")}
          rows={3}
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

  const stepLabel = (s: StepDef) => s.kind === "fact" ? t(`facts.${s.key}.label`) : t(`questions.${s.key}.label`);

  function renderStep(s: StepDef) {
    return (
      <>
        {s.kind === "style" && renderStyle(s.key as StyleField)}
        {s.kind === "fact" && renderFact(s.key)}
        {s.kind === "qagrid" && renderGrid(s.key)}
        {s.kind === "custom" && s.key === "meetingType" && accountId && (
          <MeetingTypeCard accountId={accountId} />
        )}
        {s.kind === "custom" && s.key === "availabilityHours" && accountId && (
          <AvailabilityCard accountId={accountId} />
        )}
        {s.kind === "custom" && (
          <ServiceStep
            stepKey={s.key}
            services={a.services}
            onServicesChange={(services) => set({ services })}
            setup={a.setup}
            onSetupChange={setSetup}
            accountId={accountId}
            account={account}
            detail={detail}
            onSaveAccount={onSaveAccount}
          />
        )}
      </>
    );
  }

  const progressHeader = (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <div className="eyebrow eyebrow-sm" style={{ color: "var(--wine)" }}>{t(`sections.${currentSection}`)}</div>
            <div className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>{sectionIndex + 1}/{sections.length}</div>
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
        {sections.map((sec, i) => {
          const count = pages.filter((p) => p[0].section === sec).length;
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
        {page.length > 1 ? t(`sections.${currentSection}`) : stepLabel(def)}
      </h4>

      <div style={{ flex: bodyMaxHeight ? undefined : 1, minHeight: 0, maxHeight: bodyMaxHeight, overflowY: "auto", paddingLeft: 6, paddingRight: 6 }}>
        {page.length > 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {page.map((s) => (
              <div key={s.key}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{stepLabel(s)}</div>
                {renderStep(s)}
              </div>
            ))}
          </div>
        ) : renderStep(def)}
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
