// One of the shared voice prompts, edited in place with autosave. The row is
// used by every client line in that language, which the card says up front.
// "Show filled in" renders it the way this line's calls get it, with each
// placeholder's value in green and the engine's own additions greyed.
import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Braces, Check, Info, Loader2, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useVoiceT } from "./voiceGender";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import { PromptCodeEditor } from "@/features/prompts/components/PromptCodeEditor";
import { useAutosave, type AutosaveState } from "./useAutosave";
import { resolvedSegments, type Segment } from "./resolvedSegments";
import { PromptVersions } from "./PromptVersions";
import { PromptCounts } from "./PromptCounts";
import type { VoicePromptRow } from "./voicePromptsApi";
import type { VoiceCard } from "./readiness";

export const EDITOR_HEIGHT = 460;

export function AutosaveBadge({ state }: { state: AutosaveState }) {
  const { t } = useVoiceT();
  if (state === "idle") return null;
  const color = state === "error" ? "var(--stage-lost)" : "var(--mute)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
      {state === "saving" && <Loader2 size={11} className="animate-spin" />}
      {state === "saved" && <Check size={11} />}
      {state === "error" && <AlertTriangle size={11} />}
      {t(`prompt.autosave.${state}`)}
    </span>
  );
}

const SEGMENT_STYLE: Record<Segment["kind"], React.CSSProperties> = {
  text: {},
  value: { background: "var(--good-tint)", color: "var(--good)", fontWeight: 600, borderRadius: 3, padding: "0 2px" },
  added: { color: "var(--mute)" },
};

export function FilledIn({ segments }: { segments: Segment[] }) {
  const { t } = useVoiceT();
  return (
    <>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--mute)", marginBottom: 8 }}>
        <span><span style={SEGMENT_STYLE.value}>{t("prompt.resolve.valueLegend")}</span></span>
        <span style={SEGMENT_STYLE.added}>{t("prompt.resolve.addedLegend")}</span>
      </div>
      <pre
        className="neu-inset-crisp"
        data-testid="voice-prompt-filled"
        style={{
          margin: 0, height: EDITOR_HEIGHT, overflowY: "auto", padding: 20, borderRadius: "var(--r-card)",
          whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.7, color: "var(--ink)",
        }}
      >
        {segments.map((s, i) => <span key={i} style={SEGMENT_STYLE[s.kind]}>{s.text}</span>)}
      </pre>
    </>
  );
}

export function SharedPromptCard({ card, kind, accountId, icon, title, help, notice, top, leanLayer, row, onSave }: {
  card: VoiceCard;
  /** Which GPT-Live prompt this is, for the engine's preview (the ElevenLabs one is coach/ElevenDraftCard). */
  kind: "layer" | "backend";
  accountId: number;
  icon: React.ReactNode;
  title: string;
  help: string;
  /** Shown above the text when this prompt is not used on the line being viewed. */
  notice?: string;
  /** Shown under the help, above the shared-prompt warning (the layer card's live prompt pick). */
  top?: React.ReactNode;
  /** The row is a lean layer (voice_lean_layer_*): previewed and counted as calls run it. */
  leanLayer?: boolean;
  row: VoicePromptRow;
  onSave: (promptId: number, text: string) => Promise<boolean>;
}) {
  const { t } = useVoiceT();
  const [text, setText] = useState(row.promptText);
  // Bumped by a restore so the uncontrolled editor reopens on the restored text.
  const [rev, setRev] = useState(0);
  const state = useAutosave(text, row.promptText, (next) => onSave(row.id, next));
  const [filled, setFilled] = useState<Segment[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  // Rendered from the text on screen, saved or not, with this line's own values.
  const showFilled = async () => {
    setResolving(true);
    setResolveError(false);
    try {
      const res = await apiFetch("/api/voice-prompts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accountId, text, leanLayer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.text !== "string") throw new Error();
      setFilled(resolvedSegments(text, body.text));
    } catch {
      setResolveError(true);
    } finally {
      setResolving(false);
    }
  };

  const toggle = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <AutosaveBadge state={state} />
      <button
        type="button"
        className={filled ? "la-btn la-btn--wine" : "la-btn la-btn--soft"}
        onClick={() => (filled ? setFilled(null) : void showFilled())}
        disabled={resolving}
        data-testid={`voice-prompt-resolve-${kind}`}
      >
        {resolving ? <Loader2 size={13} className="animate-spin" /> : filled ? <Pencil size={13} /> : <Braces size={13} />}
        {filled ? t("prompt.resolve.edit") : t("prompt.resolve.show")}
      </button>
    </div>
  );

  return (
    <VoiceCardShell card={card} icon={icon} title={title} action={toggle}>
      <p style={helpStyle}>{help}</p>
      {top}
      {notice && (
        <div
          className="neu-inset-crisp" data-testid={`voice-prompt-notice-${kind}`}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: "var(--r-button)", marginBottom: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}
        >
          <Info size={14} style={{ color: "var(--mute)", flexShrink: 0, marginTop: 2 }} />
          <span>{notice}</span>
        </div>
      )}
      <div
        className="neu-inset-crisp"
        style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: "var(--r-button)", marginBottom: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}
      >
        <AlertTriangle size={14} style={{ color: "var(--stage-contacted)", flexShrink: 0, marginTop: 2 }} />
        <span>
          {t("prompt.shared", { useCase: row.useCase })}{" "}
          <Link href="/platform/prompt-library" style={{ color: "var(--wine)" }}>{t("prompt.history", { id: row.id })}</Link>
        </span>
      </div>
      <PromptVersions
        promptId={row.id} kind={kind} getText={() => text}
        onRestore={(restored) => { setText(restored); setFilled(null); setRev((r) => r + 1); }}
      />
      {resolveError && <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("prompt.resolve.failed")}</p>}
      {filled ? (
        <FilledIn segments={filled} />
      ) : (
        <div className="neu-inset-crisp" style={{ height: EDITOR_HEIGHT, borderRadius: "var(--r-card)", overflow: "hidden" }}>
          {/* Keyed by the row so a switch back from the filled-in view opens on the latest text. */}
          <PromptCodeEditor key={`${row.id}-${rev}`} initialValue={text} fontSize={13} onChange={setText} />
        </div>
      )}
      <PromptCounts text={text} resolve={{ kind, accountId, leanLayer }} />
    </VoiceCardShell>
  );
}
