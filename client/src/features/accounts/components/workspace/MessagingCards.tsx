import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Check, X, Trash2, Loader2, Copy,
  Smartphone, Mail, ChevronDown, ChevronRight,
} from "lucide-react";
import { PanelAction, ConnectedPill, IntegrationField, EditButton, BrandTile } from "./atoms";
import { useAccountEdit } from "./useAccountEdit";
import {
  fetchMessagingStatus, provisionMessaging, deprovisionMessaging,
  type MessagingStatus,
} from "../../api/messagingApi";
import {
  fetchEmailSenderStatus, saveEmailSender, verifyEmailDomain,
  type EmailSenderStatus, type DnsRecord,
} from "../../api/emailSenderApi";
import type { AccountRow, AccountDetail, IntegrationField as IField } from "./types";
import { TwilioLogo } from "./integrationLogos";
import { IntegSection, IconTile, SectionHead, FlatRow, EditFieldInput, StatePill } from "./integrationsAtoms";

// ── Generic integration section (Twilio, etc.) ─────────────────────────────────
export function IntegrationCard({ name, logo, init, fields, cols, account, onSave, connected, extra, first }: {
  name: string; logo?: React.ReactNode; init?: string; fields: IField[]; cols: number; account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>; connected: boolean; extra?: React.ReactNode; first?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const { isEditing, saving, startEdit, cancelEdit, set, val, save } = useAccountEdit(account, onSave);
  return (
    <IntegSection first={first}>
      <SectionHead>
        {logo ? logo : <IconTile><BrandTile init={init ?? name.slice(0, 2)} size={22} connected={connected} /></IconTile>}
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{name}</span>
        <ConnectedPill on={connected} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
        {isEditing ? (
          <div className="row" style={{ gap: 6 }}>
            <PanelAction onClick={cancelEdit} disabled={saving} icon={<X size={12} />}>{t("detail.cancel")}</PanelAction>
            <PanelAction wine onClick={save} disabled={saving} icon={<Check size={12} />}>{saving ? t("detail.saving") : t("detail.save")}</PanelAction>
          </div>
        ) : (
          <EditButton label={t("detail.edit")} onClick={startEdit} />
        )}
      </SectionHead>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: "4px 14px" }}>
        {fields.map((f) => {
          const editable = isEditing && f.key !== "intake_url";
          return (
            <div key={f.key} style={{ gridColumn: f.wrap ? `span ${Math.min(2, cols)}` : "span 1" }}>
              {editable ? (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{f.label}</div>
                  <EditFieldInput value={val(f.key)} onChange={(v) => set(f.key, v)} secret={f.secret} />
                </div>
              ) : (
                <IntegrationField f={f} />
              )}
            </div>
          );
        })}
      </div>
      {extra}
    </IntegSection>
  );
}

// ── Twilio card wrapper (raised) ──────────────────────────────────────────────
export function TwilioCardWrapper({ account, d, onSave, fieldCols }: { account: AccountRow; d: AccountDetail; onSave: (field: string, value: string) => Promise<void>; fieldCols: number }) {
  const { t } = useTranslation("accounts");
  const { isEditing, saving, startEdit, cancelEdit, set, val, save } = useAccountEdit(account, onSave);

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
      <SectionHead>
        <IconTile><TwilioLogo size={22} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>Twilio</span>
        <ConnectedPill on={d.twilio.connected} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
        {isEditing ? (
          <div className="row" style={{ gap: 6 }}>
            <PanelAction onClick={cancelEdit} disabled={saving} icon={<X size={12} />}>{t("detail.cancel")}</PanelAction>
            <PanelAction wine onClick={save} disabled={saving} icon={<Check size={12} />}>{saving ? t("detail.saving") : t("detail.save")}</PanelAction>
          </div>
        ) : (
          <EditButton label={t("detail.edit")} onClick={startEdit} />
        )}
      </SectionHead>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${fieldCols}, minmax(0,1fr))`, gap: "4px 14px", marginTop: 14 }}>
        {d.twilio.fields.map((f) => {
          const editable = isEditing && f.key !== "intake_url";
          return (
            <div key={f.key}>
              {editable ? (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{f.label}</div>
                  <EditFieldInput value={val(f.key)} onChange={(v) => set(f.key, v)} secret={f.secret} />
                </div>
              ) : (
                <IntegrationField f={f} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Managed messaging (Twilio) provisioning card ───────────────────────────────
export function MessagingCard({ account, d, onSave, fieldCols }: { account: AccountRow; d: AccountDetail; onSave: (field: string, value: string) => Promise<void>; fieldCols: number }) {
  const { t } = useTranslation("accounts");
  const accountId = account.Id ?? account.id ?? 0;
  const [status, setStatus] = useState<MessagingStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetchMessagingStatus(accountId).then(setStatus).catch(() => {}).finally(() => setLoaded(true));
  }, [accountId]);

  const provision = async () => {
    setBusy(true); setError(null);
    try { setStatus(await provisionMessaging(accountId)); }
    catch (e: any) { setError(e.message || "Failed to set up messaging"); }
    finally { setBusy(false); }
  };

  const release = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return; }
    setBusy(true); setError(null);
    try { await deprovisionMessaging(accountId); setStatus(null); setDeleteConfirm(false); }
    catch (e: any) { setError(e.message || "Failed to release messaging"); }
    finally { setBusy(false); }
  };

  if (!loaded) return null;

  const managed = !!status?.managed;
  // Has a usable sender either way (managed subaccount or manually-pasted Tier-1 creds).
  const connected = managed || !!status?.fromNumber || d.twilio.connected;

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
      <SectionHead>
        <IconTile><Smartphone size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("messaging.title")}</span>
        <ConnectedPill on={connected} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
      </SectionHead>

      {!connected ? (
        <>
          <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5 }}>{t("messaging.explainer")}</p>
          <button className="la-btn la-btn--soft" disabled={busy} onClick={provision}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {busy ? t("messaging.provisioning") : t("messaging.provision")}
          </button>
          {error && <p style={{ fontSize: 11.5, color: "var(--wine)", marginTop: 10 }}>{error}</p>}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {status?.fromNumber && (
            <FlatRow
              label={t("messaging.number")}
              value={status.sandbox ? `${status.fromNumber}  ·  ${t("messaging.sandboxTag")}` : status.fromNumber}
            />
          )}
          <div className="row" style={{ gap: 16 }}>
            <StatePill label={t("messaging.sms")} state={status?.sms === "ready" ? "ready" : "none"} />
            <StatePill label={t("messaging.whatsapp")} state={status?.whatsapp || "none"} />
          </div>
          {status?.sms === "ready" && (!status?.whatsapp || status.whatsapp === "none") && (
            <p style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic" }}>{t("messaging.whatsappHint")}</p>
          )}
          {managed && (
            <div className="row" style={{ gap: 10 }}>
              <button className="la-btn la-btn--soft" disabled={busy} onClick={release} style={{ color: deleteConfirm ? "var(--wine)" : undefined }}>
                <Trash2 size={12} />
                {deleteConfirm ? t("detail.confirm") : t("messaging.release")}
              </button>
              {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
            </div>
          )}
        </div>
      )}

      {/* Advanced: use my own Twilio (manual Tier-1 fallback) */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="la-btn"
        style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)", marginTop: 16, paddingLeft: 0, fontSize: 11.5 }}
      >
        {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t("messaging.advanced")}
      </button>
      {showAdvanced && (
        <div style={{ marginTop: 12 }}>
          <TwilioCardWrapper account={account} d={d} onSave={onSave} fieldCols={fieldCols} />
        </div>
      )}
    </div>
  );
}

// ── Email sender (per-account From identity) ─────────────────────────────────────
// Lets a client send fallback/opener email from THEIR own domain instead of the shared
// Lead Awaker sender. Requires DNS verification (SPF + DKIM + DMARC) before the engine will
// use it. See server/routes/emailSender.ts + task #676 "step 8".
export function DnsRecordRow({ rec, copied, onCopy }: { rec: DnsRecord; copied: boolean; onCopy: () => void }) {
  const { t } = useTranslation("accounts");
  // ok is undefined until a verify attempt has run.
  const status = rec.ok === undefined ? null : rec.ok;
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px",
        borderRadius: "var(--r-button)", background: "var(--card)", boxShadow: "var(--sh-inset)",
      }}
    >
      <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
          {rec.kind} · {rec.type}
        </span>
        {status !== null && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: status ? "var(--good)" : "var(--wine)" }}>
            {status ? t("emailSender.recordOk") : t("emailSender.recordMissing")}
          </span>
        )}
      </div>
      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)", wordBreak: "break-all" }}>{rec.host}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", wordBreak: "break-all", marginTop: 2 }}>{rec.value}</div>
        </div>
        <button
          className="la-btn la-btn--icon"
          onClick={onCopy}
          title={t("emailSender.copy")}
          style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

export function EmailSenderCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("accounts");
  const [status, setStatus] = useState<EmailSenderStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    fetchEmailSenderStatus(accountId)
      .then((s) => { setStatus(s); setName(s.fromName || ""); setAddress(s.fromAddress || ""); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [accountId]);

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const save = async () => {
    if (!address.trim()) { setError(t("emailSender.addressRequired")); return; }
    setSaving(true); setError(null);
    try {
      const s = await saveEmailSender(accountId, { fromName: name.trim(), fromAddress: address.trim() });
      setStatus(s);
    } catch (e: any) { setError(e.message || t("emailSender.saveFailed")); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setVerifying(true); setError(null);
    try {
      const r = await verifyEmailDomain(accountId);
      setStatus((prev) => prev ? { ...prev, verified: r.verified, verifiedAt: r.verifiedAt, records: r.records } : prev);
    } catch (e: any) { setError(e.message || t("emailSender.verifyFailed")); }
    finally { setVerifying(false); }
  };

  if (!loaded) return null;

  const verified = !!status?.verified;
  const hasDomain = !!status?.sendingDomain;

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
      <SectionHead>
        <IconTile><Mail size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("emailSender.title")}</span>
        <ConnectedPill on={verified} connectedLabel={t("emailSender.verified")} notSetLabel={t("emailSender.pending")} />
      </SectionHead>

      <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5 }}>{t("emailSender.explainer")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{t("emailSender.fromName")}</div>
          <input
            className="neu-input"
            style={{ fontSize: 12, padding: "8px 11px", width: "100%" }}
            value={name}
            placeholder={t("emailSender.fromNamePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>{t("emailSender.fromAddress")}</div>
          <input
            className="neu-input"
            style={{ fontSize: 12, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }}
            value={address}
            placeholder={t("emailSender.fromAddressPlaceholder")}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 10 }}>
        <button className="la-btn la-btn--soft" disabled={saving} onClick={save}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saving ? t("detail.saving") : t("emailSender.save")}
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
      </div>

      {hasDomain && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 10, lineHeight: 1.5 }}>
            {t("emailSender.dnsExplainer", { domain: status!.sendingDomain })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {status!.records.map((rec) => (
              <DnsRecordRow
                key={rec.kind}
                rec={rec}
                copied={copied === rec.kind}
                onCopy={() => copy(rec.kind, rec.value)}
              />
            ))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <button className="la-btn la-btn--soft" disabled={verifying} onClick={verify}>
              {verifying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {verifying ? t("emailSender.verifying") : t("emailSender.verifyDomain")}
            </button>
            {verified && status?.verifiedAt && (
              <span style={{ fontSize: 11.5, color: "var(--good)" }}>{t("emailSender.verifiedNote")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
