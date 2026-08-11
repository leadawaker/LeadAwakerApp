import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, ChevronDown } from "lucide-react";
import { EditSelect, InfoRow } from "../formFields";
import { AI_DISCLOSURE_MODES, normalizeAiDisclosure } from "../useCampaignDetail";

/**
 * AI disclosure, lifted out of the Behavior tab onto the FIRST settings tab.
 *
 * It sat three tabs deep next to opt-out notices and active hours, which is
 * where a setting goes when nobody has to think about it. It is the opposite:
 * it is jurisdictional, it changes the literal first sentence a prospect reads,
 * and it is now the control that replaces the demo's old language-implies-
 * jurisdiction default. So it goes where the opener is authored.
 *
 * "First tab" is Business for a normal campaign and AI for the universal demo
 * (which hides Business). Rendering this from BusinessSectionFields covers both:
 * the universal demo renders that component in `openerOnly` mode at the top of
 * its AI tab.
 */

/**
 * Mirrors _DISCLOSURE_CLAUSE_ON / _DISCLOSURE_CLAUSE_OFF in the engine's
 * `src/automations/_helpers.py`. Duplicated deliberately and kept to the two
 * lines it is: this is a preview of what the engine will render, so it has to
 * be the engine's words, not a UI paraphrase of them. If the engine's table
 * changes, this one changes with it.
 */
const DISCLOSURE_CLAUSE: Record<"en" | "nl", { on: string; off: string }> = {
  en: { on: "the AI assistant at {company}", off: "from {company}" },
  nl: { on: "de AI-assistent van {company}", off: "van {company}" },
};

/** Only "opener" discloses in the opener itself. "second_message" renders the
 *  neutral clause there and discloses in the AI's first reply instead. */
function clauseFor(mode: string, lang: "en" | "nl", company: string): string {
  const table = DISCLOSURE_CLAUSE[lang] ?? DISCLOSURE_CLAUSE.en;
  return (mode === "opener" ? table.on : table.off).replace("{company}", company);
}

interface AiDisclosureFieldProps {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
}

export function AiDisclosureField({
  campaign, isEditing, draft, setDraft, focusField, onStartEditField,
}: AiDisclosureFieldProps) {
  const { t, i18n } = useTranslation("campaigns");
  const [showEffects, setShowEffects] = useState(false);

  const current = normalizeAiDisclosure(draft.ai_disclosure ?? campaign.ai_disclosure);
  const previewLang: "en" | "nl" =
    String(campaign.language ?? i18n.language ?? "en").toLowerCase().startsWith("nl") ? "nl" : "en";
  // Same chain as build_disclosure_clause: the universal demo generates its
  // company per lead, so it legitimately has none here and falls through.
  const company =
    String(draft.company_name ?? campaign.company_name ?? campaign.demo_client_name ?? campaign.name ?? "").trim()
    || t("config.aiDisclosureCompanyFallback");

  return (
    <div>
      <InfoRow icon={ShieldCheck} label={t("config.aiDisclosure")}
        value={t(`config.aiDisclosureOptions.${normalizeAiDisclosure(campaign.ai_disclosure)}`)}
        description={t("config.aiDisclosureHint")}
        noBorder
        {...(onStartEditField && !isEditing ? { onStartEdit: () => onStartEditField("ai_disclosure") } : {})}
        editChild={isEditing ? (
          <EditSelect
            value={current}
            onChange={(v) => setDraft(d => ({ ...d, ai_disclosure: v }))}
            options={[...AI_DISCLOSURE_MODES]}
            labels={{
              off: t("config.aiDisclosureOptions.off"),
              opener: t("config.aiDisclosureOptions.opener"),
              second_message: t("config.aiDisclosureOptions.second_message"),
            }}
            autoFocus={focusField === "ai_disclosure"}
          />
        ) : undefined}
      />

      <button
        type="button"
        onClick={() => setShowEffects((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', color: 'var(--wine)',
          fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
        }}
        aria-expanded={showEffects}
      >
        <ChevronDown
          style={{
            width: 12, height: 12, transition: 'transform 150ms',
            transform: showEffects ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        {t("config.aiDisclosureWhatChanges")}
      </button>

      {showEffects && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AI_DISCLOSURE_MODES.map((mode) => {
            const on = mode === current;
            return (
              <div
                key={mode}
                style={{
                  padding: '9px 12px', borderRadius: 'var(--r-surface)',
                  background: on ? 'var(--paper)' : 'transparent',
                  boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                  borderLeft: `3px solid ${on ? 'var(--wine)' : 'var(--line)'}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-soft)', marginBottom: 4 }}>
                  {t(`config.aiDisclosureOptions.${mode}`)}
                </div>
                {/* The opener fragment this mode actually produces. */}
                <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--ink)', marginBottom: 3 }}>
                  {`“…${clauseFor(mode, previewLang, company)}”`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mute)', lineHeight: 1.45 }}>
                  {t(`config.aiDisclosureEffects.${mode}`)}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: 'var(--mute-2)', lineHeight: 1.5 }}>
            {t("config.aiDisclosureLangNote")}
          </div>
        </div>
      )}
    </div>
  );
}
