// The comment-to-DM switch for one account: Off (default), Dry run (logs, sends nothing), Live (sends,
// and only when the server switch INSTAGRAM_DM_LIVE=1 is set too). Live asks for an inline confirm.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { DM_MODES, type DmMode } from "@shared/socialStudio";
import { dmStatusKey, type DmStatus } from "../../api/dmApi";
import { saveSocialSettings, socialSettingsKey } from "../../api/studioApi";

const MODE_COLOR: Record<DmMode, string> = { off: "var(--mute)", dry_run: "var(--warn)", live: "var(--good)" };

export function DmModeCard({ accountId, status }: { accountId: number; status: DmStatus }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [confirmLive, setConfirmLive] = useState(false);
  const [cap, setCap] = useState(String(status.hourlyCap));
  const save = useMutation({
    mutationFn: (body: { dmMode?: DmMode; dmHourlyCap?: number }) => saveSocialSettings(accountId, body),
    onSuccess: () => {
      setConfirmLive(false);
      qc.invalidateQueries({ queryKey: dmStatusKey(accountId) });
      qc.invalidateQueries({ queryKey: socialSettingsKey(accountId) });
    },
  });
  const pick = (m: DmMode) => {
    if (m === status.mode) return;
    if (m === "live") setConfirmLive(true);
    else save.mutate({ dmMode: m });
  };
  const capNumber = Number(cap);
  const capValid = Number.isInteger(capNumber) && capNumber >= 1 && capNumber <= 200;

  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }} data-testid="dm-mode-card">
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("comments.modeTitle")}</h3>
        <Pill color={MODE_COLOR[status.effectiveMode]} data-testid="dm-effective-mode">{t("comments.now", { mode: t(`comments.modes.${status.effectiveMode}`) })}</Pill>
      </div>
      <div className="la-seg la-seg--pill" role="radiogroup" aria-label={t("comments.modeTitle")} style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}>
        {DM_MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={status.mode === m} className={cn("la-seg-btn", status.mode === m && "on")}
            disabled={save.isPending} onClick={() => pick(m)} data-testid={`dm-mode-${m}`}>{t(`comments.modes.${m}`)}</button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5 }}>{t(`comments.modeHelp.${status.mode}`)}</p>

      {confirmLive && (
        <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }} data-testid="dm-live-confirm">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, color: "var(--warn)" }} />{t("comments.liveConfirm")}
          </p>
          {!status.liveSwitch && <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("comments.switchOff")}</p>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--wine" disabled={save.isPending} onClick={() => save.mutate({ dmMode: "live" })} data-testid="dm-live-yes">
              {save.isPending && <Loader2 size={12} className="animate-spin" />}{t("comments.liveYes")}
            </button>
            <button type="button" className="la-btn la-btn--plain" onClick={() => setConfirmLive(false)}>{t("comments.cancel")}</button>
          </div>
        </div>
      )}

      {status.mode === "live" && !status.liveSwitch && <p role="status" style={{ margin: 0, fontSize: 12, color: "var(--warn)" }} data-testid="dm-switch-off">{t("comments.switchOff")}</p>}
      {!status.webhookReady && <p role="status" style={{ margin: 0, fontSize: 12, color: "var(--warn)" }} data-testid="dm-webhook-missing">{t("comments.webhookMissing")}</p>}

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <label htmlFor="dm-cap" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("comments.cap")}</label>
        <input id="dm-cap" className="neu-input" type="number" min={1} max={200} value={cap} onChange={(e) => setCap(e.target.value)} style={{ width: 80, fontSize: 12.5, padding: "6px 10px" }} />
        <button type="button" className="la-btn la-btn--soft" disabled={!capValid || capNumber === status.hourlyCap || save.isPending} onClick={() => save.mutate({ dmHourlyCap: capNumber })}>{t("comments.saveCap")}</button>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)" }}>{t("comments.sentLastHour", { sent: status.sentLastHour, cap: status.hourlyCap })}</span>
      </div>
      {save.isError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t("errors.failed")}</p>}
    </section>
  );
}
