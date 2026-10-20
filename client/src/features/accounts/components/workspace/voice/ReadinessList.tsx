import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleAlert, CircleDashed, ListChecks } from "lucide-react";
import { Panel } from "../atoms";
import { READINESS_CARD, READINESS_ORDER, focusCard, type VoiceCard } from "./readiness";
import type { VoiceLine } from "./voiceApi";

function Row({ ok, optional, label, onFix }: {
  ok: boolean; optional?: boolean; label: string; onFix?: () => void;
}) {
  const { t } = useTranslation("voiceTab");
  const color = ok ? "var(--good)" : optional ? "var(--mute-2)" : "var(--warn)";
  const Icon = ok ? CheckCircle2 : optional ? CircleDashed : CircleAlert;
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--line)" }}>
      <span style={{ color, display: "flex", flexShrink: 0 }}><Icon size={17} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{label}</span>
      {ok ? (
        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--good)" }}>
          {t("readiness.ok")}
        </span>
      ) : optional ? (
        <button type="button" className="la-btn la-btn--soft" onClick={onFix}>{t("readiness.optional")}</button>
      ) : (
        <button type="button" className="la-btn la-btn--soft" onClick={onFix} style={{ color: "var(--warn)" }}>
          {t("readiness.missingFix")}
        </button>
      )}
    </li>
  );
}

export function ReadinessChecklist({ line }: { line: VoiceLine }) {
  const { t } = useTranslation("voiceTab");
  const byKey = new Map(line.readiness.items.map((i) => [i.key, i.ok]));
  const keys = READINESS_ORDER.filter((k) => byKey.has(k));
  const missing = keys.filter((k) => !byKey.get(k)).length;
  const hasExtra = Boolean(line.extraInstructions?.trim());
  const fix = (card: VoiceCard) => () => focusCard(card);

  return (
    <div data-testid="voice-readiness">
      <Panel
        icon={<ListChecks size={18} />}
        title={t("readiness.title")}
        pad={20}
        action={
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            padding: "4px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap",
            background: line.readiness.ready ? "var(--good-tint)" : "var(--warn-tint)",
            color: line.readiness.ready ? "var(--good)" : "var(--warn)",
          }}>
            {line.readiness.ready ? t("readiness.ready") : t("readiness.missingCount", { count: missing })}
          </span>
        }
      >
        <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "0 0 8px", lineHeight: 1.5 }}>{t("readiness.intro")}</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {keys.map((k) => (
            <Row key={k} ok={Boolean(byKey.get(k))} label={t(`readiness.items.${k}`)} onFix={fix(READINESS_CARD[k])} />
          ))}
          <Row ok={hasExtra} optional label={t("readiness.items.extra")} onFix={fix("extra")} />
        </ul>
      </Panel>
    </div>
  );
}
