// "Try her out": talk to this account's line in the browser, and read the
// prompt she is given, so a setting can be changed, heard and checked from one
// place. Agency only: the browser door opens a real client's persona.
//
// The prompt is rendered by the engine (server/routes/voicePrompts.ts →
// /voice/prompt-preview by account) with the same builder a call uses, so what
// is shown here cannot drift from what she hears.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Headphones, Loader2, PhoneCall } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { VoiceCardShell, FieldLabel, helpStyle } from "./voiceAtoms";
import type { VoiceLine } from "./voiceApi";

type Kind = "greeting" | "layer" | "backend";
const KINDS: Kind[] = ["greeting", "layer", "backend"];

/** The /voice-demo link that answers as this account's line. */
function testUrl(line: VoiceLine): string {
  const q = new URLSearchParams({ account: String(line.accountId), start: "1" });
  // Only labels the page before the call; the engine decides the rest.
  if (line.persona?.companyName) q.set("company", line.persona.companyName);
  if (line.locale) q.set("locale", line.locale);
  return `/voice-demo?${q.toString()}`;
}

export function TestCard({ line }: { line: VoiceLine }) {
  const { t } = useTranslation("voiceTab");
  const [kind, setKind] = useState<Kind | null>(null);
  const [texts, setTexts] = useState<Partial<Record<Kind, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canTest = !!line.persona;

  // A save elsewhere on the tab changes what she is told: drop what was read.
  useEffect(() => { setTexts({}); }, [line]);

  useEffect(() => {
    if (!kind || texts[kind] !== undefined) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/voice-prompts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, accountId: line.accountId }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(t("test.promptFailed"));
        else setTexts((prev) => ({ ...prev, [kind]: body.text as string }));
      })
      .catch(() => { if (!cancelled) setError(t("test.promptFailed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, texts, line.accountId, t]);

  return (
    <VoiceCardShell card="test" icon={<Headphones size={17} />} title={t("test.title")}>
      <p style={helpStyle}>{t("test.help")}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a
          href={canTest ? testUrl(line) : undefined}
          target="_blank"
          rel="noopener"
          className="la-btn la-btn--wine"
          aria-disabled={!canTest}
          style={canTest ? undefined : { opacity: 0.5, pointerEvents: "none" }}
          data-testid="voice-test-call"
        >
          <PhoneCall size={13} />
          {t("test.call")}
        </a>
        <span style={{ fontSize: 12, color: "var(--mute)" }}>
          {canTest ? t("test.filedNote") : t("test.needsPersona")}
        </span>
      </div>

      {canTest && (
        <div style={{ marginTop: 20 }}>
          <FieldLabel>{t("test.promptTitle")}</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={`la-btn ${kind === k ? "la-btn--wine" : "la-btn--soft"}`}
                onClick={() => setKind(kind === k ? null : k)}
                aria-pressed={kind === k}
              >
                {t(`test.kind.${k}`)}
              </button>
            ))}
          </div>
          {kind && (
            <div className="neu-inset" style={{ borderRadius: "var(--r-card)", marginTop: 12, padding: "14px 16px" }}>
              <p style={{ ...helpStyle, margin: "0 0 10px" }}>{t(`test.kindHelp.${kind}`)}</p>
              {loading && texts[kind] === undefined ? (
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} />
              ) : error ? (
                <span role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</span>
              ) : (
                <pre style={{
                  margin: 0, maxHeight: 380, overflowY: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                  fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.55, color: "var(--ink-soft)",
                }} data-testid="voice-test-prompt">
                  {texts[kind]}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </VoiceCardShell>
  );
}
