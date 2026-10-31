// The First Message field: the opener template with a live preview of what
// the engine will send ({variable} tokens resolved with the same buildMap the
// prompt preview uses), a template picker, and click-to-edit. Shared by the
// Campaigns page (BusinessSectionFields) and Chats > Settings > Reactivation.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, LayoutTemplate } from "lucide-react";
import { EditText, InfoRow, CopyButton } from "../formFields";
import { asCampaignLang } from "./fieldLocale";
import { resolveLang } from "@shared/langField";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/apiUtils";
import { buildMap, resolvePreviewPlainText, DEFAULT_NICHE_TERMS, type CampaignForPreview } from "@/features/prompts/utils/resolveVariables";
import { OpenerTemplatePicker, type OpenerTemplate } from "./OpenerTemplatePicker";
import type { DemoMode } from "../../demoMode";

export function OpenerField({ campaign, isEditing, draft, setDraft, launchName, demoMode, editProps = {}, label }: {
  campaign: any;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  /** Demo lead name typed during a screenshare: fills {first_name} in the preview. */
  launchName?: string;
  /** Picks which opener column is edited on a campaign with one opener per conversation type. */
  demoMode?: DemoMode;
  /** The Campaigns page's click-to-edit hook. */
  editProps?: Record<string, unknown>;
  /** Replaces the default "First Message" label. */
  label?: string;
}) {
  const { t, i18n } = useTranslation("campaigns");
  const uiLang = asCampaignLang(i18n.language);
  const displayText = (raw: unknown) => resolveLang(raw, uiLang === "pt" ? "en" : uiLang);
  const onTextChange = (field: string, raw: unknown, text: string) => {
    let current: Record<string, string> = {};
    const s = String(raw ?? "").trim();
    if (s.startsWith("{")) {
      try { current = JSON.parse(s); } catch { /* ok */ }
    } else if (s) {
      current = { en: s, nl: s };
    }
    current[uiLang] = text;
    setDraft(d => ({ ...d, [field]: JSON.stringify(current) }));
  };

  /* ── First Message preview ──────────────────────────────────────────────
     Live-resolves the opener with all {variable} tokens substituted, using
     the same buildMap() the AI-prompt preview uses (mirrors the engine's
     personalize_message()). Preview is the default view while editing; a
     small Edit toggle switches to the raw template. Recomputes automatically
     as Company Name / Demo Lead Name / the template text change — no manual
     refresh. Local-only — nothing is sent. */
  const session = useSession();
  const [firstMessageFocused, setFirstMessageFocused] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [nicheTerms, setNicheTerms] = useState<Record<string, Record<string, string>>>({});
  const fetchedNicheKeysRef = useRef<Set<string>>(new Set());

  // Entering edit mode always lands on the preview, not mid-edit of the raw template.
  useEffect(() => { if (isEditing) setFirstMessageFocused(false); }, [isEditing]);

  const fetchNicheTerms = async (niche: string, lang: "en" | "nl"): Promise<Record<string, string>> => {
    const defaults = DEFAULT_NICHE_TERMS[lang];
    try {
      const r = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}?lang=${lang}`);
      if (!r.ok) return defaults;
      const groups = await r.json();
      if (!groups) return defaults;
      const pick = (a?: string[]) => (Array.isArray(a) && a.length ? a[0] : "");
      const list = (a?: string[]) => (Array.isArray(a) ? a.join(", ") : "");
      return {
        ...defaults,
        project_term: pick(groups.projectTerm) || defaults.project_term,
        project_term_list: list(groups.projectTerm) || defaults.project_term_list,
        proposal_term: pick(groups.proposalTerm) || defaults.proposal_term,
        proposal_term_list: list(groups.proposalTerm) || defaults.proposal_term_list,
        decision_term: pick(groups.decisionTerm) || defaults.decision_term,
        decision_term_list: list(groups.decisionTerm) || defaults.decision_term_list,
        advisor_term: pick(groups.advisorTerm) || defaults.advisor_term,
        advisor_term_list: list(groups.advisorTerm) || defaults.advisor_term_list,
        visit_term: pick(groups.visitTerm) || defaults.visit_term,
        visit_term_list: list(groups.visitTerm) || defaults.visit_term_list,
      };
    } catch {
      return defaults;
    }
  };

  // Fetches niche terms for a niche+lang pair at most once; result lands in
  // `nicheTerms` state so live-preview reads pick it up on the next render.
  const ensureNicheTerms = (niche: string, lang: "en" | "nl") => {
    const key = `${niche}|${lang}`;
    if (fetchedNicheKeysRef.current.has(key)) return;
    fetchedNicheKeysRef.current.add(key);
    fetchNicheTerms(niche, lang).then((terms) => {
      setNicheTerms((m) => ({ ...m, [key]: terms }));
    });
  };

  const termsFor = (niche: string, lang: "en" | "nl") =>
    nicheTerms[`${niche}|${lang}`] ?? DEFAULT_NICHE_TERMS[lang];

  // Maps the merged {...campaign, ...draft} snake_case/camelCase-mixed shape
  // into CampaignForPreview, mirroring the mapper in PromptsPage.tsx so this
  // preview and the AI-prompt preview never drift on field-name handling.
  const buildCampaignForPreview = (raw: Record<string, unknown>): CampaignForPreview => {
    const get = (camel: string, snake: string) => (raw[camel] ?? raw[snake] ?? null) as string | null;
    return {
      id: Number(raw.id ?? raw.Id ?? 0),
      name: String(raw.name ?? raw.Name ?? ""),
      aiModel: String(raw.aiModel ?? raw.ai_model ?? ""),
      agentName: get("agentName", "agent_name"),
      serviceName: get("serviceName", "service_name"),
      campaignService: get("campaignService", "campaign_service"),
      campaignUsp: get("campaignUsp", "campaign_usp"),
      calendarLink: get("calendarLink", "calendar_link"),
      firstMessage: (raw.firstMessage ?? raw.first_message ?? raw.First_Message ?? null) as string | null,
      whatLeadDid: get("whatLeadDid", "what_lead_did"),
      firstTouch: get("firstTouch", "first_touch"),
      inquiriesSource: get("inquiriesSource", "inquiries_source"),
      inquiryTimeframe: get("inquiryTimeframe", "inquiry_timeframe"),
      niche: (raw.niche ?? null) as string | null,
      nicheQuestion: get("nicheQuestion", "niche_question"),
      bookingMode: (raw.bookingModeOverride ?? raw.booking_mode_override ?? null) as string | null,
      positioning: (raw.positioning ?? null) as string | null,
      aiDisclosure: get("aiDisclosure", "ai_disclosure"),
      language: (raw.language ?? null) as string | null,
      demoClientName: get("demoClientName", "demo_client_name"),
      companyName: get("companyName", "company_name"),
      aiStyleOverride: get("aiStyleOverride", "ai_style_override"),
      description: (raw.description ?? null) as string | null,
      aiRole: get("aiRole", "ai_role"),
      typoCount: (raw.typoCount ?? raw.typo_count ?? null) as number | null,
      kb: (raw.kb ?? null) as string | null,
      accountsId: (raw.accountsId ?? raw.Accounts_id ?? null) as number | null,
    };
  };

  /* ── Which opener is being edited ───────────────────────────────────────
     A campaign that runs both conversation types holds one opener per type: a
     lead who was never quoted has to be asked to confirm they are the right
     person, a lead sitting on a quote already knows exactly who is writing.
     `demoMode` is only passed on such a campaign; everywhere else there is one
     First_Message and this collapses to the previous behaviour.

     Three columns, matching apply_mode_opener() in the engine
     (automations/src/automations/conversation/prompt_builder.py):

       scoping   -> first_message_scoping   (no quote exists yet)
       decision  -> first_message_quoted    (a quote is on file)
       neither   -> First_Message           (the universal fallback)

     "decision" mapped to First_Message until 2026-08-15, so this panel edited
     the universal opener while the engine sent first_message_quoted to exactly
     the leads this mode selects — the label already read "First Message
     (quotes)", and the edit went somewhere else. DEMO_MODE_SCENARIO maps
     decision -> "deciding", which is one of the engine's _QUOTED_STAGES, so the
     two now pick the same column for the same lead. */
  const openerField =
    demoMode === "scoping" ? "first_message_scoping"
    : demoMode === "decision" ? "first_message_quoted"
    : "First_Message";
  const openerValue = openerField === "First_Message"
    ? (draft.First_Message ?? campaign.First_Message ?? campaign.first_message_template)
    : (draft[openerField] ?? (campaign as any)[openerField]);

  // Merge unsaved edits over the saved campaign so a First Message the operator
  // is actively typing (or a Company Name change made moments ago) shows live.
  // First_Message is forced to the opener actually being edited so the whole
  // preview chain (buildMap -> previewMap.first_message) resolves the right one
  // without every layer below needing to know a second column exists.
  const previewRaw: Record<string, unknown> = { ...campaign, ...draft, First_Message: openerValue };
  // Send language: what the engine will actually deliver — the whole point of
  // the main preview is to catch language/token bugs before they go out.
  const sendLang: "en" | "nl" = String(previewRaw.language ?? "en").toLowerCase().startsWith("nl") ? "nl" : "en";
  const previewNiche = String(previewRaw.niche ?? "").trim() || "__default__";
  // {first_name}: Demo Lead Name wins if filled, else the logged-in user's
  // first name (Finn or Gabriel, whoever is running the screenshare).
  const sessionFirstName = session.status === "authenticated"
    ? session.user.fullName1?.split(" ")[0]
    : undefined;
  const previewFirstName = launchName?.trim() || sessionFirstName || undefined;
  const campaignForPreview = buildCampaignForPreview(previewRaw);

  useEffect(() => { ensureNicheTerms(previewNiche, sendLang); }, [previewNiche, sendLang]);

  const previewMap = buildMap(campaignForPreview, { firstName: previewFirstName }, null, sendLang, {
    nicheTerms: termsFor(previewNiche, sendLang),
  });
  const previewText = previewMap.first_message ?? "";

  // Template picker shows the CRM's own display language, not the campaign's
  // send language — it's a browse/pick UI, not a send-accuracy check.
  const templateUiLang: "en" | "nl" = uiLang === "nl" ? "nl" : "en";
  useEffect(() => {
    if (templatesOpen) ensureNicheTerms(previewNiche, templateUiLang);
  }, [templatesOpen, previewNiche, templateUiLang]);

  const resolveTemplateBody = (rawBody: string): string =>
    resolvePreviewPlainText(rawBody, campaignForPreview, { firstName: previewFirstName }, null, templateUiLang, {
      nicheTerms: termsFor(previewNiche, templateUiLang),
    });

  const handlePickTemplate = (tpl: OpenerTemplate) => {
    setDraft(d => ({ ...d, [openerField]: JSON.stringify({ en: tpl.body.en, nl: tpl.body.nl }) }));
    setFirstMessageFocused(false); // land back on the live preview showing the applied template
  };

  return (
    <>
      {/* First Message — the opener template. This is the field Finn live-edits
          on screenshare during the demo (Part 1 of the trust-kit spec). Click the
          preview to edit; blur reverts to preview (draft autosaves as-you-type). */}
      <div>
        <InfoRow icon={MessageSquare}
          label={label ?? (demoMode ? t(`config.firstMessageFor.${demoMode}`) : t("config.firstMessage"))}
          value={displayText(openerValue)}
          editChild={isEditing ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="la-btn la-btn--soft la-btn--icon"
                title={t("config.openerTemplatesButton")}
                style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, zIndex: 1 }}
              >
                <LayoutTemplate size={14} />
              </button>
              {firstMessageFocused ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs, 6px)' }}>
                  <EditText
                    value={displayText(openerValue)}
                    onChange={(v) => onTextChange(openerField, openerValue, v)}
                    onBlur={() => setFirstMessageFocused(false)}
                    multiline
                    minRows={3}
                    autoFocus
                    placeholder={t("config.firstMessagePlaceholder") || "First message template…"}
                  />
                  <div style={{ alignSelf: 'flex-start' }}>
                    <CopyButton value={displayText(openerValue)} />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setFirstMessageFocused(true)}
                  style={{
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', cursor: 'text',
                    border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                    padding: '10px 40px 10px 12px', whiteSpace: 'pre-wrap', minHeight: 64,
                  }}
                >
                  {previewText || t("config.previewEmpty")}
                </div>
              )}
            </div>
          ) : undefined}
          {...editProps}
        />
      </div>
    <OpenerTemplatePicker
      open={templatesOpen}
      onOpenChange={setTemplatesOpen}
      uiLang={templateUiLang}
      resolveBody={resolveTemplateBody}
      onPick={handlePickTemplate}
      filterType={demoMode ?? null}
    />
    </>
  );
}
