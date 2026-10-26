// Earlier versions of the shared ElevenLabs prompt (GET /api/prompts/:id/versions), for the
// draft card. Restore only hands the old text back: the card puts it in the draft, which
// autosaves like any edit. Nothing here writes a version or touches the live prompt.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Loader2, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { formatDateTime } from "@/features/voiceCalls/format";
import type { PromptVersion } from "@/features/prompts/types";
import { helpStyle } from "../voiceAtoms";

const BTN_STYLE = { minHeight: 36 } as const;

export function DraftVersions({ promptId, onRestore }: { promptId: number; onRestore: (text: string) => void }) {
  const { t, i18n } = useTranslation("voiceCoach");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[] | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const toggle = async () => {
    setMessage(null);
    setConfirmId(null);
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/prompts/${promptId}/versions`);
      if (!res.ok) throw new Error();
      setVersions(await res.json());
      setOpen(true);
    } catch {
      setMessage({ text: t("versions.loadFailed"), bad: true });
    }
    setLoading(false);
  };

  const restore = (v: PromptVersion) => {
    onRestore(v.promptText ?? "");
    setConfirmId(null);
    setOpen(false);
    setMessage({ text: t("versions.restored", { v: v.versionNumber }), bad: false });
  };

  return (
    <div style={{ marginBottom: 12 }} data-testid="voice-draft-versions">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button" className={open ? "la-btn la-btn--wine" : "la-btn la-btn--soft"} style={BTN_STYLE}
          disabled={loading} onClick={() => void toggle()} aria-expanded={open} data-testid="voice-draft-history"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}{t("versions.history")}
        </button>
        {message && <span role="status" style={{ ...helpStyle, margin: 0, color: message.bad ? "var(--stage-lost)" : "var(--mute)" }}>{message.text}</span>}
      </div>
      {open && versions && (
        <div className="neu-inset-crisp" style={{ marginTop: 8, padding: 8, borderRadius: "var(--r-card)", maxHeight: 300, overflowY: "auto" }}>
          {versions.length === 0 && <p style={{ ...helpStyle, margin: 6 }}>{t("versions.none")}</p>}
          {versions.map((v) => {
            const hasText = !!(v.promptText ?? "").trim();
            return (
              <div key={v.id} style={{ padding: "6px 8px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", flexShrink: 0 }}>v{v.versionNumber}</span>
                  <span style={{ flexShrink: 0, color: "var(--mute)" }}>{formatDateTime(v.savedAt, i18n.language)}</span>
                  <span style={{ flex: "1 1 140px", minWidth: 0, overflowWrap: "anywhere" }}>{v.label ?? ""}</span>
                  {!hasText ? (
                    <span style={{ flexShrink: 0, color: "var(--mute)" }}>{t("versions.noText")}</span>
                  ) : confirmId !== v.id && (
                    <button type="button" className="la-btn la-btn--soft" style={BTN_STYLE} onClick={() => setConfirmId(v.id)}>
                      <RotateCcw size={13} />{t("versions.restore")}
                    </button>
                  )}
                </div>
                {confirmId === v.id && (
                  <div role="group" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={{ flex: "1 1 200px", color: "var(--ink-soft)" }}>{t("versions.restoreConfirm", { v: v.versionNumber })}</span>
                    <button type="button" className="la-btn la-btn--wine" style={BTN_STYLE} onClick={() => restore(v)}>{t("versions.restoreDo")}</button>
                    <button type="button" className="la-btn la-btn--soft" style={BTN_STYLE} onClick={() => setConfirmId(null)}>{t("common.cancel")}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
