// The account's live persona: the business text the receptionist answers
// from. Editable here; description and USP save to their sources (account
// details, communication profile) and the server brings the persona row in
// step, never touching its hand-written knowledge (storage/voicePersona.ts).
import { useMemo, useState } from "react";
import { UserRound, Loader2, Sparkles, Pencil } from "lucide-react";
import { VoiceCardShell, FieldLabel, ReadOnlyValue, SaveRow, helpStyle, inputStyle, useDraft } from "./voiceAtoms";
import { useVoiceT } from "./voiceGender";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";
import { cardAnchorId } from "./readiness";

interface PersonaFields { companyName: string; description: string; usp: string }
/** The voice PUT's persona edit (server/routes/voice-line.ts). */
type PersonaPatch = VoiceLinePatch & { persona: Partial<PersonaFields> };

const fieldHelp = { ...helpStyle, margin: "6px 0 0" } as const;

export function PersonaCard({ line, canEdit, saving, onSave, bare = false }: {
  line: VoiceLine; canEdit: boolean; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
  /** Inside another panel (Company Intel): a titled block instead of its own card. */
  bare?: boolean;
}) {
  const { t } = useVoiceT();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const persona = line.persona;

  const server = useMemo<PersonaFields>(() => ({
    companyName: persona?.companyName ?? "",
    description: persona?.description ?? "",
    usp: persona?.usp ?? "",
  }), [persona]);
  const { draft, setDraft, dirty, reset } = useDraft(server);
  const set = (k: keyof PersonaFields) => (v: string) => setDraft({ ...draft, [k]: v });

  const create = async () => {
    setError(null);
    if (!(await onSave({ createPersona: true }))) setError(t("common.saveFailed"));
  };

  const stopEditing = () => { setError(null); reset(); setEditing(false); };

  const submit = async () => {
    setError(null);
    if (!draft.companyName.trim()) { setError(t("persona.companyRequired")); return; }
    const changed: Partial<PersonaFields> = {};
    (Object.keys(draft) as (keyof PersonaFields)[]).forEach((k) => {
      if (draft[k] !== server[k]) changed[k] = k === "companyName" ? draft[k].trim() : draft[k];
    });
    const patch: PersonaPatch = { persona: changed };
    if (await onSave(patch)) setEditing(false);
    else setError(t("common.saveFailed"));
  };

  const editButton = persona && canEdit && !editing ? (
    <button type="button" className="la-btn la-btn--soft" onClick={() => setEditing(true)} data-testid="voice-persona-edit">
      <Pencil size={13} />
      {t("persona.edit")}
    </button>
  ) : undefined;

  const field = (key: keyof PersonaFields, label: string, help: string, rows?: number) => (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        rows ? (
          <textarea
            value={draft[key]}
            onChange={(e) => set(key)(e.target.value)}
            rows={rows}
            className="neu-inset-crisp"
            style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
            aria-label={label}
            data-testid={`voice-persona-${key}`}
          />
        ) : (
          <input
            value={draft[key]}
            onChange={(e) => set(key)(e.target.value)}
            className="neu-inset-crisp"
            style={inputStyle}
            aria-label={label}
            maxLength={120}
            data-testid={`voice-persona-${key}`}
          />
        )
      ) : (
        <ReadOnlyValue value={server[key]} />
      )}
      <p style={fieldHelp}>{help}</p>
    </div>
  );

  const body = (
    <>
      <p style={helpStyle}>{t("persona.help")}</p>
      {persona ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="voice-persona">
          {field("companyName", t("persona.company"), t("persona.companyHelp"))}
          {field("description", t("persona.description"), t("persona.descriptionHelp"), 3)}
          {field("usp", t("persona.usp"), t("persona.uspHelp"), 4)}
          <p style={{ ...helpStyle, margin: 0, fontStyle: "italic" }}>{t("persona.generatedNote")}</p>
          {editing && (
            <SaveRow dirty={dirty} saving={saving} error={error} onSave={submit} onReset={stopEditing} />
          )}
          {editing && !dirty && !error && (
            <div>
              <button type="button" className="la-btn la-btn--soft" onClick={stopEditing}>{t("common.discard")}</button>
            </div>
          )}
        </div>
      ) : (
        <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "22px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("persona.emptyTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--mute)", margin: "6px auto 0", maxWidth: 320, lineHeight: 1.5 }}>
            {t("persona.emptyHelp")}
          </div>
          {canEdit && (
            <button type="button" className="la-btn la-btn--wine" style={{ marginTop: 14 }} onClick={create} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {t("persona.create")}
            </button>
          )}
          {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</div>}
        </div>
      )}
    </>
  );

  if (bare) {
    return (
      <div id={cardAnchorId("persona")} data-testid="voice-card-persona" style={{ paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: "var(--mute)", display: "flex" }}><UserRound size={15} /></span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("persona.title")}</span>
          {editButton}
        </div>
        {body}
      </div>
    );
  }
  return (
    <VoiceCardShell card="persona" icon={<UserRound size={17} />} title={t("persona.title")} action={editButton}>
      {body}
    </VoiceCardShell>
  );
}
