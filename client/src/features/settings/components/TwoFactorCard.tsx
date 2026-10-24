import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Fingerprint, KeyRound, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { useToast } from "@/hooks/use-toast";
import { SettingsCard } from "./SettingsCard";
import { MethodRow } from "../twoFactor/TwoFactorPrimitives";
import { TotpPanel } from "../twoFactor/TotpPanel";
import { EmailPanel } from "../twoFactor/EmailPanel";
import { BackupCodesPanel } from "../twoFactor/BackupCodesPanel";
import { PasskeyPanel } from "../twoFactor/PasskeyPanel";
import { StepUpPanel } from "../twoFactor/StepUpPanel";
import { DevicesList } from "../twoFactor/DevicesList";
import { twoFactorRequest, useTwoFactor } from "../twoFactor/useTwoFactor";

type Panel = "totp" | "email" | "backup" | "passkey" | null;

const ok = (t: (k: string) => string) => <Pill color="hsl(var(--success))">{t("twoFactor.on")}</Pill>;

/**
 * Settings > Security: two-factor authentication. Authenticator app, email code and
 * passkeys, plus backup codes and trusted devices. Removing a method needs a recent
 * second-factor proof (StepUpPanel); adding one needs the password (PasswordGate).
 * Folded to one status line until opened, unless the account still has to enrol.
 */
export function TwoFactorCard({ flat = false }: { flat?: boolean }) {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { status, refresh } = useTwoFactor();
  const [panel, setPanel] = useState<Panel>(null);
  const [stepUp, setStepUp] = useState<{ run: () => Promise<void> } | null>(null);
  const [open, setOpen] = useState(false);

  if (!status) return null;

  const enabled = status.totp || status.email || status.passkeys > 0;
  // Someone who must enrol sees the methods straight away.
  const expanded = open || (status.required && !enabled);
  const methods = [
    status.totp ? t("twoFactor.summary.totp") : null,
    status.email ? t("twoFactor.summary.email") : null,
    status.passkeys > 0 ? t("twoFactor.summary.passkeys", { count: status.passkeys }) : null,
  ].filter(Boolean).join(", ");
  const summary = enabled ? t("twoFactor.summary.on", { methods }) : t("twoFactor.summary.off");
  const closePanel = () => { setPanel(null); void refresh(); };
  const done = (msg: string) => { setPanel(null); void refresh(); toast({ variant: "success", title: msg }); };

  const withStepUp = (run: () => Promise<void>) => {
    if (status.stepUp) void run().then(refresh);
    else setStepUp({ run });
  };
  const removeCall = (path: string, method: string, msg: string) => () =>
    twoFactorRequest(method, path).then((r) => {
      if (r.ok) toast({ variant: "success", title: msg });
      else toast({ variant: "destructive", title: r.data?.message || t("twoFactor.genericError") });
    });

  const daysLeft = status.graceEndsAt ? Math.max(0, Math.ceil((new Date(status.graceEndsAt).getTime() - Date.now()) / 86_400_000)) : 0;

  const action = (label: string, onClick: () => void, testId: string, primary = false) => (
    <button type="button" onClick={onClick} className={primary ? "la-btn la-btn--wine la-btn--pill" : "la-btn la-btn--soft"} data-testid={testId}>
      {label}
    </button>
  );

  return (
    <SettingsCard
      icon={ShieldCheck}
      title={t("twoFactor.title")}
      description={expanded ? t("twoFactor.description") : summary}
      flat={flat}
      action={
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? t("twoFactor.summary.hide") : t("twoFactor.summary.show")}
          title={expanded ? t("twoFactor.summary.hide") : t("twoFactor.summary.show")}
          className="inline-flex items-center gap-2 shrink-0"
          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--mute)" }}
          data-testid="button-two-factor-toggle"
        >
          {enabled ? ok(t) : <Pill>{t("twoFactor.off")}</Pill>}
          <ChevronDown className="h-4 w-4" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms" }} />
        </button>
      }
      data-testid="section-two-factor"
    >
      {expanded && <>
      {status.required && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: "var(--wine)", background: "var(--wine-tint)", color: "var(--wine)" }}
          role="status"
          data-testid="banner-two-factor-required"
        >
          {status.enrollRequired ? t("twoFactor.requiredNow") : t("twoFactor.requiredSoon", { count: daysLeft })}
        </div>
      )}

      {stepUp && (
        <StepUpPanel
          hasTotp={status.totp}
          hasBackup={status.backupCodes > 0}
          onCancel={() => setStepUp(null)}
          onVerified={() => {
            const run = stepUp.run;
            setStepUp(null);
            void run().then(refresh);
          }}
        />
      )}

      <div className="divide-y divide-border">
        <MethodRow
          testId="row-2fa-totp"
          title={<span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4 text-muted-foreground" />{t("twoFactor.totp.title")}</span>}
          description={t("twoFactor.totp.description")}
          status={status.totp ? ok(t) : undefined}
          actions={status.totp
            ? action(t("twoFactor.remove"), () => withStepUp(removeCall("/api/auth/2fa/totp/disable", "POST", t("twoFactor.removed"))), "button-totp-remove")
            : action(t("twoFactor.set"), () => setPanel("totp"), "button-totp-set")}
        >
          {panel === "totp" && <TotpPanel onCancel={closePanel} onDone={() => done(t("twoFactor.totp.enabled"))} />}
        </MethodRow>

        <MethodRow
          testId="row-2fa-email"
          title={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{t("twoFactor.email.title")}</span>}
          description={t("twoFactor.email.description")}
          status={status.email ? ok(t) : undefined}
          actions={status.email
            ? action(t("twoFactor.remove"), () => withStepUp(removeCall("/api/auth/2fa/email/disable", "POST", t("twoFactor.removed"))), "button-email-remove")
            : action(t("twoFactor.set"), () => setPanel("email"), "button-email-set")}
        >
          {panel === "email" && <EmailPanel onCancel={closePanel} onDone={() => done(t("twoFactor.email.enabled"))} />}
        </MethodRow>

        <MethodRow
          testId="row-2fa-passkey"
          title={<span className="inline-flex items-center gap-2"><Fingerprint className="h-4 w-4 text-muted-foreground" />{t("twoFactor.passkey.title")}</span>}
          description={t("twoFactor.passkey.description")}
          status={status.passkeys > 0 ? ok(t) : undefined}
          actions={typeof window !== "undefined" && "PublicKeyCredential" in window
            ? action(t("twoFactor.passkey.addShort"), () => setPanel("passkey"), "button-passkey-add")
            : <span className="text-xs text-muted-foreground">{t("twoFactor.passkey.unsupported")}</span>}
        >
          {status.passkeyList.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 min-h-11" data-testid={`passkey-${p.id}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{p.label || t("twoFactor.passkey.unnamed")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("twoFactor.passkey.added", { date: new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) })}
                </div>
              </div>
              <button
                type="button"
                className="la-btn la-btn--plain text-xs"
                onClick={() => withStepUp(removeCall(`/api/auth/2fa/passkey/${p.id}`, "DELETE", t("twoFactor.removed")))}
                data-testid={`button-passkey-remove-${p.id}`}
              >
                {t("twoFactor.remove")}
              </button>
            </div>
          ))}
          {panel === "passkey" && <PasskeyPanel onCancel={closePanel} onDone={() => done(t("twoFactor.passkey.enabled"))} />}
        </MethodRow>

        {enabled && (
          <>
            <MethodRow
              testId="row-2fa-backup"
              title={<span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" />{t("twoFactor.backup.title")}</span>}
              description={
                status.backupCodes === 0
                  ? t("twoFactor.backup.none")
                  : status.backupCodes <= 2
                    ? t("twoFactor.backup.low", { count: status.backupCodes })
                    : t("twoFactor.backup.remaining", { count: status.backupCodes })
              }
              actions={action(status.backupCodes ? t("twoFactor.backup.regenerate") : t("twoFactor.backup.generate"), () => setPanel("backup"), "button-backup-generate")}
            >
              {panel === "backup" && <BackupCodesPanel onCancel={closePanel} onDone={closePanel} />}
            </MethodRow>

            {status.devices.length > 0 && (
              <MethodRow testId="row-2fa-devices" title={t("twoFactor.devices.title")} description={t("twoFactor.devices.description")}>
                <DevicesList
                  devices={status.devices}
                  onRevoke={(id) => void twoFactorRequest("DELETE", `/api/auth/2fa/devices/${id}`).then(refresh)}
                  onRevokeAll={() => void twoFactorRequest("DELETE", "/api/auth/2fa/devices").then(refresh)}
                />
              </MethodRow>
            )}
          </>
        )}
      </div>
      </>}
    </SettingsCard>
  );
}
