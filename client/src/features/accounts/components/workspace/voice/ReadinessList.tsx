// Everything the line needs before a real caller is put through, as a short
// list. Shown when hovering the phone figure in the account header.
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { READINESS_ORDER } from "./readiness";
import type { VoiceLine } from "./voiceApi";

export function ReadinessList({ line }: { line: VoiceLine }) {
  const { t } = useTranslation("voiceTab");
  const byKey = new Map(line.readiness.items.map((i) => [i.key, i.ok]));
  const keys = READINESS_ORDER.filter((k) => byKey.has(k));
  const missing = keys.filter((k) => !byKey.get(k)).length;

  return (
    <div data-testid="voice-readiness">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{t("readiness.title")}</span>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
          padding: "3px 8px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap",
          background: missing ? "var(--warn-tint)" : "var(--good-tint)",
          color: missing ? "var(--warn)" : "var(--good)",
        }}>
          {missing ? t("readiness.missingCount", { count: missing }) : t("readiness.ready")}
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {keys.map((k) => {
          const ok = Boolean(byKey.get(k));
          const Icon = ok ? CheckCircle2 : CircleAlert;
          return (
            <li key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--line)" }}>
              <span style={{ color: ok ? "var(--good)" : "var(--warn)", display: "flex", flexShrink: 0 }}><Icon size={15} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: ok ? "var(--ink-soft)" : "var(--ink)", fontWeight: ok ? 400 : 600 }}>
                {t(`readiness.items.${k}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
