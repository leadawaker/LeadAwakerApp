// Prompt editor → voice preview: a highlighted value (company, description, her
// name, tone, address form, pronunciation) opens this pop-up, which edits it where
// it is stored, through the same endpoints as Calls > Settings:
//   company, description, her name, pronunciation → PUT /api/accounts/:id/voice
//   tone (perception picks), je/u (formality)     → PUT /api/accounts/:id/communication-profile
// The next call on that line hears the change.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { fetchVoiceLine, putVoiceLine, voiceLineKey, type VoiceLine } from "@/features/accounts/components/workspace/voice/voiceApi";
import { FieldLabel, helpStyle, inputStyle } from "@/features/accounts/components/workspace/voice/voiceAtoms";
import { FORMALITY_LEVELS, PERCEPTION, PERCEPTION_MAX } from "@/features/accounts/components/workspace/communication/profileConstants";
import type { PronunciationRow } from "@/features/accounts/components/workspace/communication/setupConstants";

/** The filled-in values a click can edit (the engine's mark names). */
export const EDITABLE_VALUES = ["company_name", "business", "agent_name", "tone", "address", "pronunciation"] as const;
export type EditableValue = (typeof EDITABLE_VALUES)[number];
export const isEditableValue = (name: string): name is EditableValue => (EDITABLE_VALUES as readonly string[]).includes(name);

interface Profile { perception: string[]; formality: number | null }

export function VoiceValueEditor({ accountId, name, rect, onClose, onSaved }: {
  accountId: number;
  name: EditableValue;
  /** The clicked highlight, where the pop-up opens. */
  rect: DOMRect;
  onClose: () => void;
  /** Saved: the preview renders again. */
  onSaved: () => void;
}) {
  const { t } = useTranslation("prompts");
  const { t: cp } = useTranslation("communicationProfile");
  const qc = useQueryClient();
  const [line, setLine] = useState<VoiceLine | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [formality, setFormality] = useState<number | null>(null);
  const [rows, setRows] = useState<PronunciationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usesProfile = name === "tone" || name === "address";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (usesProfile) {
          const res = await apiFetch(`/api/accounts/${accountId}/communication-profile`);
          const raw = res.ok ? await res.json() : null;
          if (cancelled) return;
          const p = { perception: Array.isArray(raw?.perception) ? raw.perception : [], formality: raw?.formality ?? null };
          setProfile(p);
          setPicks(p.perception);
          setFormality(p.formality);
        } else {
          const l = await fetchVoiceLine(accountId);
          if (cancelled) return;
          setLine(l);
          if (name === "company_name") setText(l.persona?.companyName ?? "");
          if (name === "business") setText(l.persona?.description ?? "");
          if (name === "agent_name") setText(l.agentNameCustom?.trim() || l.agentName || "");
          if (name === "pronunciation") setRows(l.pronunciation?.length ? l.pronunciation : [{ word: "", sayAs: "" }]);
        }
      } catch {
        if (!cancelled) setError(t("valueEditor.loadFailed"));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [accountId, name, usesProfile, t]);

  const loaded = usesProfile ? profile !== null : line !== null;
  // Company and description live on the account's own persona: without one there is nothing to save to.
  const noPersona = (name === "company_name" || name === "business") && line !== null && !line.persona;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (usesProfile) {
        const body = name === "tone"
          ? { perception: picks }
          : { formality, address_form: FORMALITY_LEVELS.find((l) => l.value === formality)?.address ?? null };
        const res = await apiFetch(`/api/accounts/${accountId}/communication-profile`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      } else {
        const patch =
          name === "company_name" ? { persona: { companyName: text.trim() } }
          : name === "business" ? { persona: { description: text } }
          : name === "agent_name" ? { agentNameCustom: text.trim() || null, agentName: null }
          : { pronunciation: rows.filter((r) => r.word.trim() && r.sayAs.trim()) };
        qc.setQueryData(voiceLineKey(accountId), await putVoiceLine(accountId, patch));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("valueEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const invalid = name === "company_name" && !text.trim();

  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* On the body: a transformed ancestor would make position: fixed relative to itself. */}
      {createPortal(
        <PopoverAnchor asChild>
          <div style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: "none" }} />
        </PopoverAnchor>,
        document.body,
      )}
      <PopoverContent align="start" className="w-[340px] p-4" data-testid="voice-value-editor">
        <FieldLabel>{t(`valueEditor.names.${name}`)}</FieldLabel>
        <p style={helpStyle}>{t("valueEditor.help")}</p>
        {!loaded && !error ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--mute)" }} />
        ) : noPersona ? (
          <p style={{ ...helpStyle, margin: 0 }}>{t("valueEditor.noPersona")}</p>
        ) : loaded && (
          <>
            {(name === "company_name" || name === "agent_name") && (
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={name === "agent_name" ? 60 : 120}
                className="neu-inset-crisp" style={inputStyle} onKeyDown={(e) => { if (e.key === "Enter" && !invalid) void save(); }} />
            )}
            {name === "business" && (
              <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5}
                className="neu-inset-crisp" style={{ ...inputStyle, resize: "vertical" }} />
            )}
            {name === "tone" && (
              <div className="flex flex-wrap gap-1.5">
                {PERCEPTION.map((p) => {
                  const on = picks.includes(p);
                  const full = !on && picks.length >= PERCEPTION_MAX;
                  return (
                    <button key={p} type="button" disabled={full}
                      className={on ? "la-btn la-btn--wine la-btn--pill" : "la-btn la-btn--soft la-btn--pill"}
                      onClick={() => setPicks(on ? picks.filter((x) => x !== p) : [...picks, p])}>
                      {cp(`questions.perception.options.${p}.label`)}
                    </button>
                  );
                })}
              </div>
            )}
            {name === "address" && (
              <div className="flex flex-col gap-1.5">
                {FORMALITY_LEVELS.map((l) => (
                  <label key={l.key} className="flex items-center gap-2" style={{ fontSize: 13.5, color: "var(--ink)", cursor: "pointer" }}>
                    <input type="radio" checked={formality === l.value} onChange={() => setFormality(l.value)} />
                    {cp(`questions.formality.levels.${l.key}.label`)}
                  </label>
                ))}
              </div>
            )}
            {name === "pronunciation" && (
              <div className="flex flex-col gap-1.5">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={r.word} placeholder={t("valueEditor.word")} maxLength={80} className="neu-inset-crisp"
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, word: e.target.value } : x)))} />
                    <input value={r.sayAs} placeholder={t("valueEditor.sayAs")} maxLength={120} className="neu-inset-crisp"
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sayAs: e.target.value } : x)))} />
                    <button type="button" className="la-btn la-btn--plain la-btn--icon" aria-label={t("valueEditor.remove")}
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="la-btn la-btn--soft" style={{ alignSelf: "flex-start" }}
                  onClick={() => setRows([...rows, { word: "", sayAs: "" }])}>
                  <Plus size={13} />{t("valueEditor.addWord")}
                </button>
              </div>
            )}
          </>
        )}
        {error && <p style={{ fontSize: 12, color: "hsl(var(--destructive))", margin: "10px 0 0" }}>{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 14 }}>
          <button type="button" className="la-btn la-btn--soft" onClick={onClose}>{t("valueEditor.cancel")}</button>
          <button type="button" className="la-btn la-btn--wine" disabled={!loaded || noPersona || invalid || saving} onClick={() => void save()}>
            {saving && <Loader2 size={13} className="animate-spin" />}{t("valueEditor.save")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
