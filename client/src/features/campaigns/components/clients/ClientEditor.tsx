/**
 * Edit one saved demo persona.
 *
 * The layout encodes a tested finding (specs/demo-persona-library/plan.md, "A
 * Client is ENGLISH, except its terms"): everything the MODEL reads works in
 * English alone, because the model translates as it writes. Only the five term
 * lists are substituted verbatim into the opener with no model in the loop, so
 * only those get a slot per language. That is why the long fields below are a
 * single English column and the terms are a three-column grid.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import {
  TERM_GROUPS,
  useDemoClient,
  useUpdateDemoClient,
  useDeleteDemoClient,
  type ClientTextField,
  type DemoLang,
  type DemoClientPatch,
  type TermGroup,
} from "../../api/demoClientsApi";

/** Long fields, in the order they read as a persona. `multiline` drives height. */
const TEXT_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp", rows: 2 },
  { field: "descriptionTemplate", labelKey: "clients.fields.description", rows: 3 },
  { field: "kbTemplate", labelKey: "clients.fields.kb", rows: 6 },
  { field: "nicheQuestion", labelKey: "clients.fields.nicheQuestion", rows: 2 },
  { field: "leadContext", labelKey: "clients.fields.leadContext", rows: 2 },
  { field: "scopingLadder", labelKey: "clients.fields.scopingLadder", rows: 8 },
  { field: "questionBank", labelKey: "clients.fields.questionBank", rows: 4 },
  { field: "objectionExamples", labelKey: "clients.fields.objections", rows: 4 },
];

/** Fields that ARE substituted verbatim, so they get the per-language treatment. */
const OPENER_FIELDS: Array<{ field: ClientTextField; labelKey: string; rows?: number }> = [
  { field: "firstMessage", labelKey: "clients.fields.firstMessage", rows: 3 },
  { field: "openerPhrase", labelKey: "clients.fields.openerPhrase" },
  { field: "whenLabel", labelKey: "clients.fields.whenLabel" },
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
  onDeleted: () => void;
}

export function ClientEditor({ niche, onBack, onDeleted }: ClientEditorProps) {
  const { t } = useTranslation("campaigns");
  const { data: client, isLoading } = useDemoClient(niche);
  const update = useUpdateDemoClient();
  const remove = useDeleteDemoClient();

  // Local draft so typing is not fighting a refetch. Seeded once per Client.
  const [text, setText] = useState<Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>>({});
  const [terms, setTerms] = useState<Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>>>({});
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!client) return;
    setText(client.text);
    // Terms live as arrays; the editor edits them as one comma-separated line
    // per language, which is how people actually think about a synonym list.
    const asLines: Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>> = {};
    for (const group of TERM_GROUPS) {
      asLines[group] = {
        en: (client.terms[group]?.en ?? []).join(", "),
        nl: (client.terms[group]?.nl ?? []).join(", "),
        pt: (client.terms[group]?.pt ?? []).join(", "),
      };
    }
    setTerms(asLines);
    setDirty(false);
  }, [client?.niche, client?.updatedAt]);

  const setTextSlot = (field: ClientTextField, lang: DemoLang, value: string) => {
    setText((d) => ({ ...d, [field]: { ...(d[field] ?? {}), [lang]: value } }));
    setDirty(true);
  };

  const setTermSlot = (group: TermGroup, lang: DemoLang, value: string) => {
    setTerms((d) => ({ ...d, [group]: { ...(d[group] ?? {}), [lang]: value } }));
    setDirty(true);
  };

  const save = () => {
    const patch: DemoClientPatch = { text: text as DemoClientPatch["text"], terms: {} };
    for (const group of TERM_GROUPS) {
      patch.terms![group] = {
        en: splitTerms(terms[group]?.en),
        nl: splitTerms(terms[group]?.nl),
        pt: splitTerms(terms[group]?.pt),
      };
    }
    update.mutate({ niche, patch }, { onSuccess: () => setDirty(false) });
  };

  const languagesWithTerms = useMemo(
    () => LANGS.filter((l) => TERM_GROUPS.some((g) => (terms[g]?.[l] ?? "").trim())),
    [terms],
  );

  // Curated niche packs are listed and editable but not deletable: real
  // campaigns read their word lists. The server refuses with a 409, so do not
  // offer a button that cannot work. This reads the flag rather than guessing
  // from content, because every curated row has a description too.
  const canDelete = client?.isDemoClient ?? false;

  if (isLoading || !client) {
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
          <div className="serif italic" style={{ fontSize: 30, color: "var(--ink)", lineHeight: 1.1 }}>
            {client.niche}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canDelete && (
            <button
              className="la-btn la-btn--soft"
              onClick={() => setConfirmDelete(true)}
              title={t("clients.delete", "Delete Client")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            className="la-btn la-btn--wine la-btn--pill"
            onClick={save}
            disabled={!dirty || update.isPending}
            style={{ opacity: !dirty || update.isPending ? 0.5 : 1 }}
          >
            {update.isPending ? t("clients.saving", "Saving...") : t("clients.save", "Save")}
          </button>
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
              values={terms[group] ?? {}}
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
                    value={text[field]?.[l] ?? ""}
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
                value={text[field]?.en ?? ""}
                onChange={(e) => setTextSlot(field, "en", e.target.value)}
                rows={rows ?? 1}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </section>

      {confirmDelete && (
        <ConfirmDelete
          niche={client.niche}
          pending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate(client.niche, { onSuccess: onDeleted })}
        />
      )}
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

/** Destructive confirmation. Dialog is allowed here and only here. */
function ConfirmDelete({
  niche,
  pending,
  onCancel,
  onConfirm,
}: {
  niche: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("campaigns");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="neu-raised"
        style={{ background: "var(--card)", padding: 26, borderRadius: "var(--r-card)", maxWidth: 380, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="serif" style={{ fontSize: 20, color: "var(--ink)", marginBottom: 8 }}>
          {t("clients.confirmDeleteTitle", "Delete this Client?")}
        </div>
        <p style={{ fontSize: 13, color: "var(--mute)", lineHeight: 1.5, marginBottom: 18 }}>
          {t("clients.confirmDeleteBody", { niche })}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="la-btn la-btn--soft" onClick={onCancel}>
            {t("clients.cancel", "Cancel")}
          </button>
          <button className="la-btn la-btn--wine" onClick={onConfirm} disabled={pending}>
            {pending ? t("clients.deleting", "Deleting...") : t("clients.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "keuken, keukenproject" → ["keuken", "keukenproject"]. */
function splitTerms(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}
