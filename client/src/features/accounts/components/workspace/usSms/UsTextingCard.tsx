// Accounts > Integrations > WhatsApp & texting: US texting (A2P 10DLC), agency
// only. Four steps, each unlocked by the one before: register the business
// (brand), describe the texts (campaign), buy a number on the account's own
// messaging profile, then connect the number to the approved campaign. The
// engine sends from Accounts.telnyx_sms_number and routes replies by it.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Loader2, MessageSquareText, RefreshCw, X } from "lucide-react";
import {
  assignState, brandState, campaignState, numberState, useUsSms, useUsSmsAction, type StepState,
} from "./usSmsApi";
import { BrandForm, CampaignForm, NumberPicker, Submit } from "./UsSmsForms";

const cardStyle: React.CSSProperties = { borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--card)" };
const help = { fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, margin: "0 0 10px" } as const;

function Pill({ state }: { state: StepState }) {
  const { t } = useTranslation("usTexting");
  const color = state === "done" ? "var(--stage-booked, var(--wine))" : state === "failed" ? "var(--stage-lost)" : "var(--mute)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color, whiteSpace: "nowrap" }}>
      {state === "done" ? <Check size={12} /> : state === "failed" ? <X size={12} /> : state === "pending" ? <Loader2 size={12} /> : null}
      {t(`status.${state}`)}
    </span>
  );
}

function Step({ n, title, state, open, children }: { n: number; title: string; state: StepState; open: boolean; children: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }} data-testid={`us-sms-step-${n}`}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)" }}>{String(n).padStart(2, "0")}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: open ? "var(--ink)" : "var(--ink-soft)", flex: 1 }}>{title}</span>
        <Pill state={state} />
      </header>
      {children && <div style={{ paddingTop: 10 }}>{children}</div>}
    </section>
  );
}

export function UsTextingCard({ accountId, accountName }: { accountId: number; accountName: string }) {
  const { t } = useTranslation("usTexting");
  const { data, isLoading } = useUsSms(accountId);
  const act = useUsSmsAction(accountId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  // Folded by default: the steps are long and most accounts never need them.
  const [unfolded, setUnfolded] = useState(false);

  const run = (key: string, path: string, body?: unknown) => async () => {
    setBusy(key); setError(null);
    try { await act(path, body); } catch (e) { setError((e as Error).message || t("failed")); } finally { setBusy(null); }
  };

  const reg = data?.registration ?? null;
  const brand = brandState(reg);
  const campaign = campaignState(reg);
  const number = numberState(data);
  const assign = assignState(data);
  const soleProp = reg?.entityType === "SOLE_PROPRIETOR";

  return (
    <div className="neu-raised" style={cardStyle} data-testid="us-sms-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: unfolded ? 8 : 0 }}>
        <button type="button" onClick={() => setUnfolded((v) => !v)} aria-expanded={unfolded} data-testid="us-sms-toggle"
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          <MessageSquareText size={17} style={{ color: "var(--wine)" }} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("title")}</h4>
          {!unfolded && <Pill state={assign === "done" ? "done" : reg ? "pending" : "todo"} />}
          <ChevronDown size={16} style={{ color: "var(--mute)", transform: unfolded ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
        {unfolded && reg && (
          <button type="button" className="la-btn la-btn--soft" onClick={run("refresh", "/refresh")} disabled={!!busy} data-testid="us-sms-refresh">
            {busy === "refresh" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{t("refresh")}
          </button>
        )}
      </div>
      {unfolded && (<>
      <p style={help}>{t("intro")}</p>
      <p style={{ ...help, fontSize: 12 }}>{t("costs")}</p>
      {data && !data.enabled && (
        <p className="neu-inset-crisp" style={{ ...help, padding: "10px 14px", borderRadius: "var(--r-button)", color: "var(--ink-soft)" }} data-testid="us-sms-off">
          {t("off")}
        </p>
      )}
      {(error || reg?.lastError) && (
        <p role="alert" style={{ ...help, color: "var(--stage-lost)" }}>{t("error", { message: error || reg?.lastError })}</p>
      )}

      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <>
          <Step n={1} title={t("steps.brand")} state={brand} open>
            {brand === "todo" ? (
              <>
                <p style={help}>{t("brand.help")}</p>
                <BrandForm accountName={accountName} busy={busy === "brand"} onSubmit={(b) => void run("brand", "/brand", b)()} />
              </>
            ) : (
              <>
                <p style={{ ...help, margin: 0 }}>{t("brand.summary", { name: reg?.details?.brand?.displayName ?? accountName, id: reg?.brandId })}</p>
                {soleProp && brand !== "done" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <p style={{ ...help, margin: 0 }}>{t("brand.otpHelp")}</p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="la-btn la-btn--soft" onClick={run("otp", "/brand/otp")} disabled={!!busy}>
                        {busy === "otp" && <Loader2 size={13} className="animate-spin" />}{reg?.details?.otpSentAt ? t("brand.otpSent") : t("brand.otpSend")}
                      </button>
                      <input className="la-input" style={{ maxWidth: 140 }} value={otp} onChange={(e) => setOtp(e.target.value.trim())} placeholder={t("brand.otpCode")} aria-label={t("brand.otpCode")} />
                      <button type="button" className="la-btn la-btn--wine" onClick={run("verify", "/brand/otp/verify", { otpPin: otp })} disabled={!!busy || !otp}>
                        {busy === "verify" && <Loader2 size={13} className="animate-spin" />}{t("brand.otpVerify")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Step>

          <Step n={2} title={t("steps.campaign")} state={campaign} open={brand !== "todo"}>
            {brand === "todo" ? null : campaign === "todo" ? (
              <>
                <p style={help}>{t("campaign.help")}</p>
                <CampaignForm accountName={reg?.details?.brand?.displayName || accountName} soleProp={soleProp} busy={busy === "campaign"}
                  onSubmit={(c) => void run("campaign", "/campaign", c)()} />
              </>
            ) : (
              <p style={{ ...help, margin: 0 }}>
                {t("campaign.summary", { usecase: reg?.usecase ? t(`campaign.usecases.${reg.usecase}`, reg.usecase) : "", id: reg?.campaignId })}
              </p>
            )}
          </Step>

          <Step n={3} title={t("steps.number")} state={number} open={brand !== "todo"}>
            {brand === "todo" ? null : number === "todo" ? (
              <>
                <p style={help}>{t("number.help")}</p>
                <NumberPicker accountId={accountId} busy={busy === "number"} onBuy={(phoneNumber) => void run("number", "/number", { phoneNumber })()} />
              </>
            ) : (
              <p style={{ ...help, margin: 0, fontFamily: "var(--mono)" }}>{data?.number || reg?.details?.orderedNumber}</p>
            )}
          </Step>

          <Step n={4} title={t("steps.assign")} state={assign} open={campaign === "done" && number === "done"}>
            {assign === "todo" ? (
              campaign === "done" && number === "done" ? (
                <>
                  <p style={help}>{t("assign.help")}</p>
                  <Submit busy={busy === "assign"} label={t("assign.submit")} onClick={() => void run("assign", "/assign")()} />
                </>
              ) : <p style={{ ...help, margin: 0 }}>{t("assign.waitCampaign")}</p>
            ) : (
              <p style={{ ...help, margin: 0 }}>{t("assign.summary", { number: data?.number })}</p>
            )}
          </Step>
        </>
      )}
      </>)}
    </div>
  );
}
