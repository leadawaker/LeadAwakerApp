// Save version and History for a Prompt_Library row, on the prompt page's own
// endpoints (/api/prompts/:id/versions). Used by SharedPromptCard, so every
// voice prompt card gets it. Restoring hands the old text back to the card,
// which saves it like any edit; the text it replaces is kept as a version first.
import { useState } from "react";
import { History, Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { formatDateTime } from "@/features/voiceCalls/format";
import type { PromptVersion } from "@/features/prompts/types";
import { useVoiceT } from "./voiceGender";
import { helpStyle } from "./voiceAtoms";

const versionsUrl = (promptId: number) => `/api/prompts/${promptId}/versions`;

export async function postVersion(promptId: number, text: string, label: string): Promise<boolean> {
  const res = await apiFetch(versionsUrl(promptId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bumpType: "minor", promptText: text, label: label.trim() || null }),
  }).catch(() => null);
  return !!res?.ok;
}

export function PromptVersions({ promptId, kind, getText, onRestore }: {
  promptId: number;
  kind: string;
  /** The text on screen right now. */
  getText: () => string;
  onRestore: (text: string) => void;
}) {
  const { t, i18n } = useVoiceT();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [versions, setVersions] = useState<PromptVersion[] | null>(null);
  const [open, setOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);

  const loadVersions = async () => {
    const res = await apiFetch(versionsUrl(promptId)).catch(() => null);
    if (!res?.ok) throw new Error();
    setVersions(await res.json());
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await postVersion(promptId, getText(), note);
    if (ok) {
      setNote("");
      setNoting(false);
      if (open) await loadVersions().catch(() => {});
      else setVersions(null);
    }
    setMessage({ text: t(ok ? "prompt.versions.saved" : "prompt.versions.saveFailed"), bad: !ok });
    setBusy(false);
  };

  const toggleHistory = async () => {
    setMessage(null);
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      await loadVersions();
      setOpen(true);
    } catch {
      setMessage({ text: t("prompt.versions.loadFailed"), bad: true });
    }
    setLoading(false);
  };

  const restore = async (v: PromptVersion) => {
    if (!(v.promptText ?? "").trim()) return;
    setBusy(true);
    setMessage(null);
    const ok = await postVersion(promptId, getText(), t("prompt.versions.beforeRestore", { v: v.versionNumber }));
    if (ok) {
      onRestore(v.promptText ?? "");
      setRestoreId(null);
      setOpen(false);
      setVersions(null);
    }
    setMessage({ text: t(ok ? "prompt.versions.restored" : "prompt.versions.saveFailed", { v: v.versionNumber }), bad: !ok });
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: 12 }} data-testid={`voice-prompt-versions-${kind}`}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => { setMessage(null); setNoting((n) => !n); }} data-testid={`voice-prompt-save-version-${kind}`}>
          <Save size={13} />{t("prompt.versions.save")}
        </button>
        <button type="button" className={open ? "la-btn la-btn--wine" : "la-btn la-btn--soft"} disabled={busy || loading} onClick={() => void toggleHistory()} data-testid={`voice-prompt-history-${kind}`}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}{t("prompt.versions.history")}
        </button>
        {message && <span role="status" style={{ ...helpStyle, margin: 0, color: message.bad ? "var(--stage-lost)" : "var(--mute)" }}>{message.text}</span>}
      </div>
      {noting && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input
            value={note} maxLength={200} onChange={(e) => setNote(e.target.value)}
            placeholder={t("prompt.versions.notePlaceholder")} aria-label={t("prompt.versions.notePlaceholder")}
            className="neu-inset-crisp"
            style={{ flex: "1 1 220px", minWidth: 0, padding: "8px 12px", borderRadius: "var(--r-button)", fontSize: 13, background: "transparent", color: "var(--ink)" }}
          />
          <button type="button" className="la-btn la-btn--wine" disabled={busy} onClick={() => void save()}>{t("prompt.versions.saveConfirm")}</button>
        </div>
      )}
      {open && versions && (
        <div className="neu-inset-crisp" style={{ marginTop: 8, padding: 8, borderRadius: "var(--r-card)", maxHeight: 260, overflowY: "auto" }}>
          {versions.length === 0 && <p style={{ ...helpStyle, margin: 6 }}>{t("prompt.versions.none")}</p>}
          {versions.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", fontSize: 12.5, color: "var(--ink-soft)" }}>
              <span style={{ fontFamily: "var(--mono)", flexShrink: 0 }}>v{v.versionNumber}</span>
              <span style={{ flexShrink: 0, color: "var(--mute)" }}>{formatDateTime(v.savedAt, i18n.language)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.label ?? ""}>{v.label ?? ""}</span>
              {restoreId === v.id ? (
                <>
                  <button type="button" className="la-btn la-btn--wine" disabled={busy} onClick={() => void restore(v)}>{t("prompt.versions.restoreConfirm")}</button>
                  <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => setRestoreId(null)}>{t("prompt.versions.cancel")}</button>
                </>
              ) : !(v.promptText ?? "").trim() ? (
                <span style={{ flexShrink: 0, color: "var(--mute)" }}>{t("prompt.versions.noText")}</span>
              ) : (
                <button type="button" className="la-btn la-btn--soft" disabled={busy} onClick={() => { setMessage(null); setRestoreId(v.id); }}>{t("prompt.versions.restore")}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
