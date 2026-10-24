// Characters and tokens of a prompt card, counted on the text as the engine
// resolves it (variables filled, via the preview route) once `resolve` is set,
// else on the text itself. Tokens use the GPT tokenizer the prompt library
// page uses; the ElevenLabs count is marked approx. because its model differs.
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { useVoiceT } from "./voiceGender";

type Counter = (s: string) => number;
let counterPromise: Promise<Counter> | null = null;

// Lazy: the BPE rank table is ~2MB, so it loads once the first card mounts.
function loadCounter(): Promise<Counter> {
  counterPromise ??= import("gpt-tokenizer/model/gpt-5").then((m) => m.countTokens as Counter);
  return counterPromise;
}

export interface ResolveRequest { kind: "layer" | "backend" | "eleven"; accountId: number; lineId?: number }

export function PromptCounts({ text, resolve, approx }: { text: string; resolve?: ResolveRequest; approx?: boolean }) {
  const { t, i18n } = useVoiceT();
  const [counts, setCounts] = useState<{ chars: number; tokens: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const kind = resolve?.kind, accountId = resolve?.accountId, lineId = resolve?.lineId;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        let resolved = text;
        // An emptied editor is 0, not the saved row (the engine previews the row for blank text).
        if (kind && accountId && text.trim()) {
          const res = await apiFetch("/api/voice-prompts/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, accountId, lineId, text }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || typeof body.text !== "string") throw new Error();
          resolved = body.text;
        }
        const count = await loadCounter();
        if (!cancelled) { setCounts({ chars: resolved.length, tokens: count(resolved) }); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, kind, accountId, lineId]);

  const n = (v: number) => v.toLocaleString(i18n.language);
  const label = failed && !counts
    ? t("prompt.counts.failed")
    : counts
      ? t(approx ? "prompt.counts.approx" : "prompt.counts.exact", { chars: n(counts.chars), tokens: n(counts.tokens) })
      : "…";
  return (
    <div data-testid="prompt-counts" style={{ marginTop: 6, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", color: "var(--mute)" }}>
      {label}
    </div>
  );
}
