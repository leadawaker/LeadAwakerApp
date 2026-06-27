import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Check, X, Trash2, Loader2, Copy, Eye, EyeOff,
  ExternalLink, Calendar, KeyRound, ChevronDown, ChevronRight, Smartphone, Mail,
} from "lucide-react";
import { PanelAction, ConnectedPill, IntegrationField, EditButton, BrandTile } from "./atoms";
import { useAccountEdit } from "./useAccountEdit";
import { VoiceCloneSection } from "./VoiceCloneSection";
import { MissedCallCard } from "./MissedCallCard";
import {
  fetchCalendarProviders, fetchCalendarConnections, startCalendarOAuth, connectCalendarKey, disconnectCalendar,
  provisionBookingPage, fetchCaldiyCredentials,
  type CalendarProviderId, type CalendarProviderMeta, type CalendarConnection, type CaldiyCredentials,
} from "../../api/calendarApi";
import {
  fetchMessagingStatus, provisionMessaging, deprovisionMessaging,
  type MessagingStatus,
} from "../../api/messagingApi";
import {
  fetchEmailSenderStatus, saveEmailSender, verifyEmailDomain,
  type EmailSenderStatus, type DnsRecord,
} from "../../api/emailSenderApi";
import type { AccountRow, AccountDetail, IntegrationField as IField } from "./types";
import {
  TwilioLogo,
  CalendarProviderLogo,
} from "./integrationLogos";

const CALENDAR_PROVIDER_ORDER: CalendarProviderId[] = ["google", "outlook", "calcom", "calendly", "ical"];
// Clients only ever connect via one-click OAuth (Google/Outlook); the token is
// injected into their Cal.diy booking page automatically.
const CLIENT_CALENDAR_PROVIDERS: CalendarProviderId[] = ["google", "outlook"];

// ── Shared helpers ─────────────────────────────────────────────────────────────
function IntegSection({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ padding: "22px 24px", ...(first ? {} : { borderTop: "1.5px solid var(--line)" }) }}>
      {children}
    </div>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0,
      background: "var(--card)", boxShadow: "var(--sh-raised-crisp)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)",
    }}>
      {children}
    </span>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

// ── Flat credential row (booking page / display-only values) ───────────────────
function FlatRow({ label, value, extra, children }: { label: string; value?: string; extra?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, padding: "6px 0" }}>
      <div style={{ width: 90, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || children || <span style={{ color: "var(--mute-2)", fontStyle: "italic" }}>—</span>}
      </div>
      {extra}
    </div>
  );
}

// ── Calendar connect ───────────────────────────────────────────────────────────
function CalendarConnectCard({ accountId, noBorder, clientMode }: { accountId: number; noBorder?: boolean; clientMode?: boolean }) {
  const { t } = useTranslation("accounts");
  const providerOrder = clientMode ? CLIENT_CALENDAR_PROVIDERS : CALENDAR_PROVIDER_ORDER;
  const [providers, setProviders] = useState<CalendarProviderMeta[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [provider, setProvider] = useState<CalendarProviderId>("google");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    try { setConnections(await fetchCalendarConnections(accountId)); } catch { /* ignore */ }
  }, [accountId]);

  useEffect(() => {
    fetchCalendarProviders().then(setProviders).catch(() => {});
    refresh();
  }, [refresh]);

  const meta = providers.find((p) => p.id === provider);
  const inputStyle: React.CSSProperties = { fontSize: 11.5, padding: "8px 11px", width: "100%" };
  const visibleConnections = connections.filter((c) => (c.provider as string) !== "caldiy");
  const hasConnections = visibleConnections.length > 0;

  const handleConnect = async () => {
    setError(null);
    if (meta?.authType === "oauth") { startCalendarOAuth(provider, accountId); return; }
    setBusy(true);
    try {
      await connectCalendarKey(provider, accountId, provider === "ical" ? { icalUrl: secret } : { apiKey: secret });
      setSecret("");
      setShowAddForm(false);
      await refresh();
    } catch (e: any) { setError(e.message || "Failed to connect"); }
    finally { setBusy(false); }
  };

  const handleDisconnect = async (p: CalendarProviderId) => {
    setBusy(true);
    try { await disconnectCalendar(accountId, p); await refresh(); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const body = (
    <>
      <SectionHead>
        <IconTile><Calendar size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("calendar.title")}</span>
        <ConnectedPill
          on={hasConnections}
          connectedLabel={t("pills.nConnected", { count: connections.length })}
          notSetLabel={t("pills.notSet")}
        />
        {hasConnections && (
          <button
            className="la-btn la-btn--soft la-btn--icon"
            title={t("calendar.add", "Add calendar")}
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus size={12} />
          </button>
        )}
      </SectionHead>

      {hasConnections && (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: showAddForm ? 14 : 0 }}>
          {visibleConnections.map((c) => (
            <div key={c.id} className="row" style={{ gap: 12, padding: "6px 0" }}>
              <CalendarProviderLogo provider={c.provider} size={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(`calendar.providers.${c.provider}`)}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: c.status === "connected" ? "var(--good)" : "var(--warn)", marginTop: 1 }}>
                  {c.displayName || c.status}
                </div>
              </div>
              <button className="la-btn la-btn--icon" disabled={busy} onClick={() => handleDisconnect(c.provider)} title={t("calendar.disconnect")} style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(!hasConnections || showAddForm) && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: meta?.authType === "oauth" ? "1fr" : "1fr 1.4fr", gap: 14, alignItems: "end" }}>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>
                {t("calendar.provider")}
              </div>
              <select
                className="neu-input"
                style={inputStyle}
                value={provider}
                onChange={(e) => { setProvider(e.target.value as CalendarProviderId); setSecret(""); setError(null); }}
              >
                {providerOrder.map((p) => (
                  <option key={p} value={p}>{t(`calendar.providers.${p}`)}</option>
                ))}
              </select>
            </div>
            {meta?.authType !== "oauth" && (
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>
                  {provider === "ical" ? t("calendar.url") : t("calendar.apiKey")}
                </div>
                <input
                  className="neu-input"
                  style={inputStyle}
                  type={provider === "ical" ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={provider === "ical" ? t("calendar.urlPlaceholder") : t("calendar.apiKeyPlaceholder")}
                />
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="la-btn la-btn--soft" disabled={busy || (meta?.authType !== "oauth" && !secret)} onClick={handleConnect}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {meta?.authType === "oauth" ? t("calendar.connectWith", { provider: t(`calendar.providers.${provider}`) }) : t("calendar.connect")}
            </button>
            {meta && !meta.canPush && (
              <span style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic" }}>{t("calendar.readOnlyNote")}</span>
            )}
            {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
          </div>
        </>
      )}
    </>
  );

  if (noBorder) return <>{body}</>;
  return <IntegSection>{body}</IntegSection>;
}

// ── Booking page ───────────────────────────────────────────────────────────────
function BookingPageCard({ accountId, noBorder }: { accountId: number; noBorder?: boolean }) {
  const { t } = useTranslation("accounts");
  const [creds, setCreds] = useState<CaldiyCredentials | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetchCaldiyCredentials(accountId).then(setCreds).catch(() => {}).finally(() => setLoaded(true));
  }, [accountId]);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const provision = async () => {
    setBusy(true); setError(null);
    try { const r = await provisionBookingPage(accountId); setCreds(r); setRevealed(true); }
    catch (e: any) { setError(e.message || "Failed to provision booking page"); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return; }
    setBusy(true); setError(null);
    try { await disconnectCalendar(accountId, "caldiy" as CalendarProviderId); setCreds(null); setDeleteConfirm(false); }
    catch (e: any) { setError(e.message || "Failed to delete booking page"); }
    finally { setBusy(false); }
  };

  if (!loaded) return null;

  const flatBtn = { background: "transparent", boxShadow: "none", color: "var(--mute-2)" } as React.CSSProperties;

  const body = (
    <>
      <SectionHead>
        <IconTile><KeyRound size={16} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("calendar.booking.title")}</span>
        <ConnectedPill on={!!creds} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
      </SectionHead>

      {!creds ? (
        <>
          <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5 }}>{t("calendar.booking.explainer")}</p>
          <button className="la-btn la-btn--soft" disabled={busy} onClick={provision}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {busy ? t("calendar.booking.provisioning") : t("calendar.booking.provision")}
          </button>
          {error && <p style={{ fontSize: 11.5, color: "var(--wine)", marginTop: 10 }}>{error}</p>}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <FlatRow
            label={t("calendar.booking.bookingUrl")}
            value={creds.bookingUrl}
            extra={
              <div className="row" style={{ gap: 2 }}>
                <button className="la-btn la-btn--icon" onClick={() => window.open(creds.bookingUrl, "_blank")} style={flatBtn}><ExternalLink size={13} /></button>
                <button className="la-btn la-btn--icon" onClick={() => copy("url", creds.bookingUrl)} style={flatBtn}>{copied === "url" ? <Check size={13} /> : <Copy size={13} />}</button>
              </div>
            }
          />
          <FlatRow
            label={t("calendar.booking.username")}
            value={creds.username}
            extra={<button className="la-btn la-btn--icon" onClick={() => copy("username", creds.username)} style={flatBtn}>{copied === "username" ? <Check size={13} /> : <Copy size={13} />}</button>}
          />
          <FlatRow
            label={t("calendar.booking.password")}
            value={revealed ? creds.password : "••••••••••••"}
            extra={
              <div className="row" style={{ gap: 2 }}>
                <button className="la-btn la-btn--icon" onClick={() => setRevealed((v) => !v)} title={t("calendar.booking.reveal")} style={flatBtn}>
                  {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button className="la-btn la-btn--icon" onClick={() => copy("password", creds.password)} style={flatBtn}>
                  {copied === "password" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            }
          />
          <p style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic", marginTop: 8 }}>{t("calendar.booking.sendHint")}</p>
          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <button className="la-btn la-btn--soft" disabled={busy} onClick={provision}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t("calendar.booking.regenerate")}
            </button>
            <button className="la-btn la-btn--soft" disabled={busy} onClick={handleDelete} style={{ color: deleteConfirm ? "var(--wine)" : undefined }}>
              <Trash2 size={12} />
              {deleteConfirm ? t("detail.confirm") : t("toolbar.delete")}
            </button>
            {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
          </div>
        </div>
      )}
    </>
  );

  if (noBorder) return <>{body}</>;
  return <IntegSection>{body}</IntegSection>;
}

// ── Booking page: client view (read-only link) ──────────────────────────────────
// The client connects their calendar via the CalendarConnectCard (one click); the
// token is injected into their Cal.diy page automatically. Here we only surface the
// resulting booking link — no usernames, no separate Cal.diy login.
function BookingLinkReadOnly({ accountId, noBorder }: { accountId: number; noBorder?: boolean }) {
  const { t } = useTranslation("accounts");
  const [creds, setCreds] = useState<CaldiyCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetchCaldiyCredentials(accountId).then(setCreds).catch(() => {}).finally(() => setLoaded(true));
  }, [accountId]);

  if (!loaded || !creds) return null;

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const flatBtn = { background: "transparent", boxShadow: "none", color: "var(--mute-2)" } as React.CSSProperties;

  const body = (
    <>
      <SectionHead>
        <IconTile><Calendar size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("calendar.booking.title")}</span>
        <ConnectedPill on={true} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
      </SectionHead>

      <FlatRow
        label={t("calendar.booking.bookingUrl")}
        value={creds.bookingUrl}
        extra={
          <div className="row" style={{ gap: 2 }}>
            <button className="la-btn la-btn--icon" onClick={() => window.open(creds.bookingUrl, "_blank")} title={t("calendar.booking.openBookingPage")} style={flatBtn}><ExternalLink size={13} /></button>
            <button className="la-btn la-btn--icon" onClick={() => copy(creds.bookingUrl)} style={flatBtn}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
          </div>
        }
      />

      <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 14, lineHeight: 1.5 }}>{t("calendar.booking.clientExplainer")}</p>
    </>
  );

  if (noBorder) return <>{body}</>;
  return <IntegSection>{body}</IntegSection>;
}

// ── Generic integration section (Twilio, etc.) ─────────────────────────────────
function EditFieldInput({ value, onChange, secret }: { value: string; onChange: (v: string) => void; secret?: boolean }) {
  return (
    <input
      className="neu-input"
      style={{ fontSize: 11.5, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }}
      type={secret ? "password" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function IntegrationCard({ name, logo, init, fields, cols, account, onSave, connected, extra, first }: {
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
function TwilioCardWrapper({ account, d, onSave, fieldCols }: { account: AccountRow; d: AccountDetail; onSave: (field: string, value: string) => Promise<void>; fieldCols: number }) {
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

// ── Messaging state pill (SMS / WhatsApp) ──────────────────────────────────────
function StatePill({ label, state }: { label: string; state: string }) {
  const { t } = useTranslation("accounts");
  const styles: Record<string, { bg: string; fg: string; key: string }> = {
    ready:    { bg: "color-mix(in srgb, var(--good) 14%, transparent)", fg: "var(--good)", key: "messaging.state.ready" },
    approved: { bg: "color-mix(in srgb, var(--good) 14%, transparent)", fg: "var(--good)", key: "messaging.state.ready" },
    pending:  { bg: "var(--warn-tint)", fg: "var(--stage-booked)", key: "messaging.state.pending" },
    rejected: { bg: "color-mix(in srgb, var(--wine) 14%, transparent)", fg: "var(--wine)", key: "messaging.state.rejected" },
    none:     { bg: "color-mix(in srgb, var(--mute) 12%, transparent)", fg: "var(--mute)", key: "messaging.state.none" },
  };
  const c = styles[state] || styles.none;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{label}</span>
      <span style={{ background: c.bg, color: c.fg, borderRadius: "var(--r-pill)", padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>{t(c.key)}</span>
    </span>
  );
}

// ── Managed messaging (Twilio) provisioning card ───────────────────────────────
function MessagingCard({ account, d, onSave, fieldCols }: { account: AccountRow; d: AccountDetail; onSave: (field: string, value: string) => Promise<void>; fieldCols: number }) {
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
function DnsRecordRow({ rec, copied, onCopy }: { rec: DnsRecord; copied: boolean; onCopy: () => void }) {
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

function EmailSenderCard({ accountId }: { accountId: number }) {
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

// ── Main panel ─────────────────────────────────────────────────────────────────
export function IntegrationsPanel({ account, d, onSave, fieldCols = 3, stacked = false, withVoice = true, readOnly = false }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  withVoice?: boolean;
  readOnly?: boolean;
}) {
  const accountId = account.Id ?? account.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!readOnly && (
        <MessagingCard account={account} d={d} onSave={onSave} fieldCols={fieldCols} />
      )}

      {!readOnly && <EmailSenderCard accountId={accountId} />}

      {!readOnly && <MissedCallCard accountId={accountId} />}

      {/* Calendar + Booking side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
          <CalendarConnectCard accountId={accountId} noBorder clientMode={readOnly} />
        </div>
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" }}>
          {readOnly ? (
            <BookingLinkReadOnly accountId={accountId} noBorder />
          ) : (
            <BookingPageCard accountId={accountId} noBorder />
          )}
        </div>
      </div>

      {withVoice && !readOnly && (
        <div style={{ padding: "0 0 20px" }}>
          <VoiceCloneSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} />
        </div>
      )}
    </div>
  );
}
