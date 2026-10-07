// Preview for the voice agents' prompts (use_case voice_*): the text in the
// editor, saved or not, rendered by the engine exactly as one Client's call
// receives it (server/routes/voicePrompts.ts → engine /voice/prompt-preview).
//
// Rendered by the engine rather than here because the voice layer is filled
// by Python (persona, knowledge, wizard slots, today's date, the phone-only
// transfer section); a TypeScript copy of that would drift.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";

type Kind = "layer" | "greeting" | "backend";

/** Which builder and language a voice use_case belongs to. */
export function voicePromptTarget(useCase: string): { kind: Kind; locale: string } | null {
  if (!useCase.startsWith("voice_")) return null;
  const layer = useCase.match(/^voice_layer_(.+)$/);
  if (layer) return { kind: "layer", locale: layer[1]! };
  const greeting = useCase.match(/^voice_greeting_(.+)$/);
  if (greeting) return { kind: "greeting", locale: greeting[1]! };
  // The backend rows: voice_receptionist_demo (English), _nl, _pt.
  const lang = useCase.match(/_(nl|pt)$/)?.[1];
  return { kind: "backend", locale: lang === "nl" ? "nl" : lang === "pt" ? "pt-BR" : "en-GB" };
}

const CLIENT_KEY = "prompts.voicePreviewClient";
// Gabriel's own line answers as this Client, so it is the useful default.
const DEFAULT_CLIENT = "Lead Awaker";

function readClient(): string {
  try {
    return localStorage.getItem(CLIENT_KEY) ?? DEFAULT_CLIENT;
  } catch {
    return DEFAULT_CLIENT;
  }
}

interface Preview {
  text: string;
  company: string | null;
  phone_line: string | null;
  chars: number;
}

export function VoicePreviewPane({
  useCase,
  text,
  font,
}: {
  useCase: string;
  /** The editor's current text; a new value re-renders after a short pause. */
  text: string;
  font: string;
}) {
  const { t } = useTranslation("prompts");
  const target = useMemo(() => voicePromptTarget(useCase), [useCase]);
  const [clients, setClients] = useState<string[]>([]);
  const [client, setClientState] = useState<string>(readClient);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setClient = (next: string) => {
    setClientState(next);
    try { localStorage.setItem(CLIENT_KEY, next); } catch { /* private mode */ }
  };

  useEffect(() => {
    apiFetch("/api/niche-vocabulary")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const names = rows.map((r) => r.niche as string).filter((n) => n && n !== "__default__");
        names.sort((a, b) => (a === DEFAULT_CLIENT ? -1 : b === DEFAULT_CLIENT ? 1 : a.localeCompare(b)));
        setClients(names);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/voice-prompts/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: target.kind, text, locale: target.locale, niche: client || null }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.message || t("voicePreview.failed"));
        } else {
          setPreview(body as Preview);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t("voicePreview.failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [target, text, client, t]);

  if (!target) return null;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--paper)" }}>
      <div
        className="flex items-center gap-2 shrink-0 px-5 pt-3 pb-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700 }}>
          {t("voicePreview.client")}
        </span>
        <select
          className="neu-inset-super-crisp px-2 py-1 text-xs"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">{t("voicePreview.noClient")}</option>
          {clients.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--mute)" }}>
          {t(`voicePreview.kind.${target.kind}`)} · {target.locale}
        </span>
        <span className="ml-auto flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--mute)" }}>
          {loading && <Loader2 size={12} className="animate-spin" />}
          {preview && t("voicePreview.chars", { count: preview.chars })}
        </span>
      </div>
      {preview?.phone_line && (
        <div className="shrink-0 px-5 pt-2" style={{ fontSize: 11, color: "var(--mute)" }}>
          {t("voicePreview.phoneLine", { number: preview.phone_line })}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
        {error ? (
          <span style={{ fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</span>
        ) : (
          <pre style={{ fontFamily: font, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--ink)", margin: 0 }}>
            {preview?.text ?? ""}
          </pre>
        )}
      </div>
    </div>
  );
}
