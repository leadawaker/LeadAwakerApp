/**
 * Edit one saved demo persona.
 *
 * The layout encodes a tested finding (specs/demo-persona-library/plan.md, "A
 * Client is ENGLISH, except its terms"): everything the MODEL reads works in
 * English alone, because the model translates as it writes. Only the five term
 * lists are substituted verbatim into the opener with no model in the loop, so
 * only those get a slot per language. That is why the long fields below are a
 * single English column and the terms are a three-column grid.
 *
 * Autosaves 1.5s after the last edit (mirrors useCampaignDetail.ts). Duplicate
 * and Delete live in the topbar's "..." menu (ClientActionsMenu.tsx), not here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import {
  TERM_GROUPS,
  useDemoClient,
  useUpdateDemoClient,
  formatClientTitle,
  type ClientTextField,
  type DemoLang,
  type DemoClientPatch,
  type EditableDemoClient,
  type TermGroup,
} from "../../api/demoClientsApi";
import { CategorySelect } from "./CategorySelect";

/** Long fields, in the order they read as a persona. `multiline` drives height. */
const TEXT_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp", rows: 2 },
  { field: "descriptionTemplate", labelKey: "clients.fields.description", rows: 3 },
  { field: "kbTemplate", labelKey: "clients.fields.kb", rows: 6 },
  { field: "nicheQuestion", labelKey: "clients.fields.nicheQuestion", rows: 2 },
  { field: "enquiryContext", labelKey: "clients.fields.enquiryContext", rows: 2 },
  { field: "quoteContext", labelKey: "clients.fields.quoteContext", rows: 5 },
  { field: "scopingLadder", labelKey: "clients.fields.scopingLadder", rows: 8 },
  { field: "questionBank", labelKey: "clients.fields.questionBank", rows: 4 },
  { field: "objectionExamples", labelKey: "clients.fields.objections", rows: 4 },
];

/**
 * Fields that ARE substituted verbatim, so they get the per-language treatment.
 *
 * quoteSubject and quoteWhen are the two halves of the QUOTED opener, the one
 * campaign 60 sends to a lead who already has a price ("about the
 * {quote_subject} we quoted {quote_when}"). They belong here and not in
 * TEXT_FIELDS for the usual reason: no model sees them, they are pasted into
 * the sentence as typed. Leaving a slot empty is safe — the engine falls back
 * to the project term, then to the inquiry timeframe.
 */
const OPENER_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "firstMessage", labelKey: "clients.fields.firstMessage", rows: 3 },
  { field: "openerPhrase", labelKey: "clients.fields.openerPhrase" },
  { field: "whenLabel", labelKey: "clients.fields.whenLabel" },
  { field: "quoteSubject", labelKey: "clients.fields.quoteSubject" },
  { field: "quoteWhen", labelKey: "clients.fields.quoteWhen" },
];

const LANGS: DemoLang[] = ["en", "nl", "pt"];

const labelStyle: React.CSSProperties = {
  fontFamily: "Geist Mono, ui-monospace, monospace",
  fontSize: 10,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--mute-2)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--ink)",
  background: "var(--input)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-input, 10px)",
  padding: "9px 12px",
  resize: "vertical",
};

interface ClientEditorProps {
  niche: string;
  onBack: () => void;
}

/** Everything ClientEditor autosaves, as one flat draft object. */
interface Draft {
  text: Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>;
  terms: Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>>;
  category: string;
  emoji: string;
}

function buildDraft(client: EditableDemoClient): Draft {
  const terms: Draft["terms"] = {};
  for (const group of TERM_GROUPS) {
    terms[group] = {
      en: (client.terms[group]?.en ?? []).join(", "),
      nl: (client.terms[group]?.nl ?? []).join(", "),
      pt: (client.terms[group]?.pt ?? []).join(", "),
    };
  }
  return {
    text: client.text,
    terms,
    category: client.category ?? "",
    emoji: client.emoji ?? "",
  };
}

/** "keuken, keukenproject" -> ["keuken", "keukenproject"]. */
function splitTerms(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

function buildPatch(d: Draft): DemoClientPatch {
  const patch: DemoClientPatch = {
    text: d.text as DemoClientPatch["text"],
    terms: {},
    category: d.category.trim() || null,
    emoji: d.emoji.trim() || null,
  };
  for (const group of TERM_GROUPS) {
    patch.terms![group] = {
      en: splitTerms(d.terms[group]?.en),
      nl: splitTerms(d.terms[group]?.nl),
      pt: splitTerms(d.terms[group]?.pt),
    };
  }
  return patch;
}

function draftsEqual(a: Draft | null, b: Draft | null): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ClientEditor({ niche, onBack }: ClientEditorProps) {
  const { t } = useTranslation("campaigns");
  const { data: client, isLoading } = useDemoClient(niche);
  const update = useUpdateDemoClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [originalDraft, setOriginalDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const originalDraftRef = useRef(originalDraft);
  originalDraftRef.current = originalDraft;
  const nicheRef = useRef(niche);
  nicheRef.current = niche;

  // Load this Client's data into the draft. Re-fires only when the Client
  // IDENTITY changes (a different niche opened), never on a same-entity
  // refetch: reseeding on `updatedAt` would replace the user's live draft
  // with the server's just-saved (and server-trimmed) copy ~200-500ms after
  // every autosave, mangling text under the cursor (trailing space/newline
  // eaten mid-keystroke). Mirrors useCampaignDetail.ts, which reseeds only
  // on identity change too.
  useEffect(() => {
    if (!client) return;
    const d = buildDraft(client);
    setDraft(d);
    setOriginalDraft(d);
  }, [client?.niche]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    (d: Draft) => {
      const savedNiche = nicheRef.current;
      setSaving(true);
      update.mutate(
        { niche: savedNiche, patch: buildPatch(d) },
        {
          onSuccess: () => {
            // Only reconcile `originalDraft` if we're still looking at the
            // Client this save was for — the parent may have swapped `niche`
            // in place (no remount) while this PATCH was in flight.
            if (nicheRef.current === savedNiche) setOriginalDraft(d);
            setSaving(false);
          },
          onError: () => setSaving(false),
        },
      );
    },
    [update],
  );

  // Fire-and-forget variant for the flush paths below: the component is
  // switching to a different Client (or unmounting), so there is no local
  // state left to reconcile an onSuccess into.
  const flushSave = useCallback(
    (targetNiche: string, d: Draft) => {
      update.mutate({ niche: targetNiche, patch: buildPatch(d) });
    },
    [update],
  );

  // Debounced autosave: 1.5s after the last edit, mirrors useCampaignDetail.ts.
  useEffect(() => {
    if (draftsEqual(draft, originalDraft)) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      // Clear first: once this fires, no timer is pending anymore, so the
      // switch/unmount flush paths below must not treat it as still pending.
      autoSaveTimer.current = null;
      if (draftRef.current) doSave(draftRef.current);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, originalDraft, doSave]);

  // Flush a pending save for the PREVIOUS niche when the parent switches which
  // Client is open (no remount: ClientsTab swaps the `niche` prop in place).
  const prevNicheRef = useRef(niche);
  useEffect(() => {
    if (autoSaveTimer.current && prevNicheRef.current !== niche) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      const prevNiche = prevNicheRef.current;
      const d = draftRef.current;
      const orig = originalDraftRef.current;
      if (d && !draftsEqual(d, orig)) flushSave(prevNiche, d);
    }
    prevNicheRef.current = niche;
  }, [niche, flushSave]);

  // Flush on unmount (navigating off the Clients tab entirely).
  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        const d = draftRef.current;
        const orig = originalDraftRef.current;
        if (d && !draftsEqual(d, orig)) flushSaveRef.current(nicheRef.current, d);
      }
    };
  }, []);

  const setTextSlot = (field: ClientTextField, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, text: { ...d.text, [field]: { ...(d.text[field] ?? {}), [lang]: value } } } : d));
  };

  const setTermSlot = (group: TermGroup, lang: DemoLang, value: string) => {
    setDraft((d) => (d ? { ...d, terms: { ...d.terms, [group]: { ...(d.terms[group] ?? {}), [lang]: value } } } : d));
  };

  const setCategory = (value: string) => setDraft((d) => (d ? { ...d, category: value } : d));
  const setEmoji = (value: string) => setDraft((d) => (d ? { ...d, emoji: value } : d));

  const languagesWithTerms = useMemo(
    () => (draft ? LANGS.filter((l) => TERM_GROUPS.some((g) => (draft.terms[g]?.[l] ?? "").trim())) : []),
    [draft],
  );

  if (isLoading || !client || !draft) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="la-btn la-btn--soft la-btn--icon" onClick={onBack} title={t("clients.back", "Back")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="eyebrow wine">{t("clients.editing", "Client")}</div>
          <div className="serif italic" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1.25 }}>
            {formatClientTitle(client)}
          </div>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--mute)" }}>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {t("clients.saving", "Saving...")}
          </span>
        )}
      </div>

      {/* ── Identity: category + emoji ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 240 }}>
          <label style={labelStyle}>{t("clients.categoryLabel", "Category")}</label>
          <CategorySelect value={draft.category} onChange={setCategory} />
        </div>
        <div style={{ width: 90 }}>
          <label style={labelStyle}>{t("clients.emojiLabel", "Emoji")}</label>
          <input
            value={draft.emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="🍳"
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Terms: the only genuinely per-language part ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.termsTitle", "Words")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.termsHint")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "110px repeat(3, 1fr)", gap: 10, alignItems: "center" }}>
          <span />
          {LANGS.map((l) => (
            <span key={l} style={{ ...labelStyle, marginBottom: 0 }}>
              {l.toUpperCase()}
              {!languagesWithTerms.includes(l) && (
                <span style={{ color: "var(--mute-2)", opacity: 0.6 }}> {t("clients.empty", "(empty)")}</span>
              )}
            </span>
          ))}
          {TERM_GROUPS.map((group) => (
            <ClientTermRow
              key={group}
              label={t(`clients.terms.${group}`)}
              values={draft.terms[group] ?? {}}
              onChange={(lang, v) => setTermSlot(group, lang, v)}
            />
          ))}
        </div>
      </section>

      {/* ── Opener: substituted verbatim, so per-language too ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.openerTitle", "Opener")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.openerHint")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {OPENER_FIELDS.map(({ field, labelKey, rows }) => (
            <div key={field}>
              <label style={labelStyle}>{t(labelKey)}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {LANGS.map((l) => (
                  <textarea
                    key={l}
                    value={draft.text[field]?.[l] ?? ""}
                    onChange={(e) => setTextSlot(field, l, e.target.value)}
                    rows={rows ?? 1}
                    placeholder={l.toUpperCase()}
                    style={inputStyle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Everything the model reads: English is enough ── */}
      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.personaTitle", "Persona")}</div>
        <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
          {t("clients.personaHint")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {TEXT_FIELDS.map(({ field, labelKey, rows }) => (
            <div key={field}>
              <label style={labelStyle}>{t(labelKey)}</label>
              <textarea
                value={draft.text[field]?.en ?? ""}
                onChange={(e) => setTextSlot(field, "en", e.target.value)}
                rows={rows ?? 1}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** One term group across the three languages. */
function ClientTermRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: Partial<Record<DemoLang, string>>;
  onChange: (lang: DemoLang, value: string) => void;
}) {
  return (
    <>
      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{label}</span>
      {LANGS.map((l) => (
        <input
          key={l}
          value={values[l] ?? ""}
          onChange={(e) => onChange(l, e.target.value)}
          style={{ ...inputStyle, padding: "7px 10px" }}
        />
      ))}
    </>
  );
}
