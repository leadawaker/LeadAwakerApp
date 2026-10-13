// How the assistant behaves on the client's WhatsApp number: who it answers,
// and (for a number that stays on the client's phone) what happens when the
// owner replies to a customer themselves. The engine reads these on the next
// message (src/webhooks/whatsapp_coexistence.py).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Check, Loader2 } from "lucide-react";
import { IconTile, SectionHead } from "../integrationsAtoms";
import { CARD_STYLE, EXPLAINER, MONO_LABEL, Note } from "./whatsappAtoms";
import { useWhatsappSender, type WhatsappSender } from "./whatsappApi";

const SCOPES: WhatsappSender["aiScope"][] = ["all", "new_only", "off"];
const RESUME_HOURS: (number | null)[] = [null, 2, 4, 24];

export function WhatsAppBehaviourCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("whatsappCloud");
  const { sender, behaviour } = useWhatsappSender(accountId);
  const [command, setCommand] = useState(sender?.resumeCommand ?? "/go");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (sender) setCommand(sender.resumeCommand); }, [sender?.resumeCommand]);
  if (!sender) return null;
  const onPhone = sender.onboardingMode === "app";

  const save = async (patch: Parameters<typeof behaviour.mutateAsync>[0]) => {
    setError(null);
    try { await behaviour.mutateAsync(patch); } catch { setError(t("behaviour.saveFailed")); }
  };

  const segBtn = (on: boolean): React.CSSProperties => ({
    flex: "1 1 0", minWidth: 0, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
    border: `1px solid ${on ? "var(--wine)" : "var(--line-strong)"}`,
    background: on ? "var(--wine-tint)" : "var(--paper)", color: "var(--ink)",
  });

  return (
    <div className="neu-raised" style={CARD_STYLE} data-testid="whatsapp-behaviour-card">
      <SectionHead>
        <IconTile><Bot size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("behaviour.title")}</span>
        {behaviour.isPending && <Loader2 size={13} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      </SectionHead>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={MONO_LABEL}>{t("behaviour.scopeLabel")}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup">
            {SCOPES.filter((s) => s !== "new_only" || onPhone).map((s) => {
              const on = sender.aiScope === s;
              return (
                <button key={s} type="button" role="radio" aria-checked={on} style={segBtn(on)} disabled={behaviour.isPending}
                  onClick={() => !on && void save({ aiScope: s })} data-testid={`whatsapp-scope-${s}`}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                    {on && <Check size={12} style={{ color: "var(--wine)" }} />}{t(`behaviour.scope.${s}.title`)}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--mute)", marginTop: 3, lineHeight: 1.4 }}>{t(`behaviour.scope.${s}.help`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {onPhone && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={MONO_LABEL}>{t("behaviour.takeoverLabel")}</span>
            <p style={{ ...EXPLAINER, margin: 0 }}>{t("behaviour.takeoverHelp")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{t("behaviour.commandLabel")}</span>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value.replace(/\s/g, "").slice(0, 20))}
                onBlur={() => { if (command.length >= 2 && command !== sender.resumeCommand) void save({ resumeCommand: command }); }}
                style={{ width: 90, fontFamily: "var(--mono)", fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--paper)", color: "var(--ink)" }}
                data-testid="whatsapp-resume-command"
              />
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)", marginLeft: 6 }}>{t("behaviour.autoLabel")}</span>
              <select
                value={sender.resumeAfterHours ?? ""}
                onChange={(e) => void save({ resumeAfterHours: e.target.value ? Number(e.target.value) : null })}
                style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--paper)", color: "var(--ink)" }}
              >
                {RESUME_HOURS.map((h) => (
                  <option key={h ?? "never"} value={h ?? ""}>{h ? t("behaviour.afterHours", { count: h }) : t("behaviour.never")}</option>
                ))}
              </select>
            </div>
            <Note tone="mute">{t("behaviour.commandVisible", { command: sender.resumeCommand })}</Note>
          </div>
        )}
        {error && <Note tone="bad">{error}</Note>}
      </div>
    </div>
  );
}
