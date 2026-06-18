import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Check, X, Trash2, Loader2, Copy, Eye, EyeOff,
  ExternalLink, KeyRound, ChevronDown, ChevronRight, Wrench,
} from "lucide-react";
import { PanelAction, ConnectedPill, IntegrationField, EditButton, BrandTile } from "./atoms";
import { useAccountEdit } from "./useAccountEdit";
import { VoiceCloneSection } from "./VoiceCloneSection";
import { syncInstagramContacts } from "../../api/accountsApi";
import {
  fetchCalendarProviders, fetchCalendarConnections, startCalendarOAuth, connectCalendarKey, disconnectCalendar,
  provisionBookingPage, fetchCaldiyCredentials,
  type CalendarProviderId, type CalendarProviderMeta, type CalendarConnection, type CaldiyCredentials,
} from "../../api/calendarApi";
import type { AccountRow, AccountDetail, IntegrationField as IField } from "./types";
import {
  TwilioLogo, GoogleCalLogo, CalcomLogo, IcalLogo, InstagramLogo,
  SlackLogo, HubspotLogo, EmailLogo, CalendarProviderLogo,
} from "./integrationLogos";

const CALENDAR_PROVIDER_ORDER: CalendarProviderId[] = ["google", "outlook", "calcom", "calendly", "ical"];

// ── Shared standalone card shell ───────────────────────────────────────────────
function IntegCard({ children, pad = 18 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", padding: pad }}>
      {children}
    </div>
  );
}

// ── Calendar connect ───────────────────────────────────────────────────────────
function CalendarConnectCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("accounts");
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
  const hasConnections = connections.length > 0;

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

  return (
    <IntegCard>
      {/* Header */}
      <div className="row" style={{ gap: 12, marginBottom: hasConnections ? 14 : 16 }}>
        <GoogleCalLogo size={36} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("calendar.title")}</span>
        <ConnectedPill
          on={hasConnections}
          connectedLabel={t("pills.nConnected", { count: connections.length })}
          notSetLabel={t("pills.notSet")}
        />
        {hasConnections && (
          <button
            className="la-btn la-btn--inset la-btn--icon"
            title={t("calendar.add", "Add calendar")}
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Connected list */}
      {hasConnections && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: showAddForm ? 14 : 0 }}>
          {connections.map((c) => (
            <div
              key={c.id}
              className="row"
              style={{ gap: 11, padding: "9px 12px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
            >
              <CalendarProviderLogo provider={c.provider} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(`calendar.providers.${c.provider}`)}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: c.status === "connected" ? "var(--good)" : "var(--warn)", marginTop: 2 }}>
                  {c.displayName || c.status}
                </div>
              </div>
              <button className="la-btn la-btn--inset la-btn--icon" disabled={busy} onClick={() => handleDisconnect(c.provider)} title={t("calendar.disconnect")}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form — always shown when no connections, toggled by + otherwise */}
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
                {CALENDAR_PROVIDER_ORDER.map((p) => (
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
            <button className="la-btn la-btn--wine" disabled={busy || (meta?.authType !== "oauth" && !secret)} onClick={handleConnect}>
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
    </IntegCard>
  );
}

// ── Booking page ───────────────────────────────────────────────────────────────
function BookingPageCard({ accountId }: { accountId: number }) {
  const { t } = useTranslation("accounts");
  const [creds, setCreds] = useState<CaldiyCredentials | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) return null;

  return (
    <IntegCard>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <span style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--wine)" }}>
          <KeyRound size={18} />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("calendar.booking.title")}</span>
        <ConnectedPill on={!!creds} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
      </div>

      {!creds ? (
        <>
          <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5 }}>{t("calendar.booking.explainer")}</p>
          <button className="la-btn la-btn--wine" disabled={busy} onClick={provision}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {busy ? t("calendar.booking.provisioning") : t("calendar.booking.provision")}
          </button>
          {error && <p style={{ fontSize: 11.5, color: "var(--wine)", marginTop: 10 }}>{error}</p>}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "url", label: t("calendar.booking.bookingUrl"), value: creds.bookingUrl, extra: <button className="la-btn la-btn--inset la-btn--icon" onClick={() => window.open(creds.bookingUrl, "_blank")}><ExternalLink size={13} /></button> },
            { key: "username", label: t("calendar.booking.username"), value: creds.username },
            { key: "password", label: t("calendar.booking.password"), value: revealed ? creds.password : "••••••••••••", isSecret: true },
          ].map(({ key, label, value, extra, isSecret }) => (
            <div key={key} className="row" style={{ gap: 11, padding: "10px 12px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
              </div>
              {extra}
              {isSecret && (
                <button className="la-btn la-btn--inset la-btn--icon" onClick={() => setRevealed((v) => !v)} title={t("calendar.booking.reveal")}>
                  {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              <button className="la-btn la-btn--inset la-btn--icon" onClick={() => copy(key, key === "password" ? creds.password : key === "username" ? creds.username : creds.bookingUrl)}>
                {copied === key ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          ))}
          <p style={{ fontSize: 10.5, color: "var(--mute)", fontStyle: "italic" }}>{t("calendar.booking.sendHint")}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="la-btn la-btn--soft" disabled={busy} onClick={provision}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t("calendar.booking.regenerate")}
            </button>
            {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
          </div>
        </div>
      )}
    </IntegCard>
  );
}

// ── Generic integration card (Twilio, etc.) ────────────────────────────────────
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

function IntegrationCard({ name, logo, init, fields, cols, account, onSave, connected, extra }: {
  name: string; logo?: React.ReactNode; init?: string; fields: IField[]; cols: number; account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>; connected: boolean; extra?: React.ReactNode;
}) {
  const { t } = useTranslation("accounts");
  const { isEditing, saving, startEdit, cancelEdit, set, val, save } = useAccountEdit(account, onSave);
  return (
    <IntegCard>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        {logo ?? <BrandTile init={init ?? name.slice(0, 2)} size={36} connected={connected} />}
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
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 14 }}>
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
    </IntegCard>
  );
}

// ── WIP collapsible section (Instagram, Email, HubSpot, Slack) ─────────────────
const WIP_INTEGRATIONS = [
  { key: "instagram", label: "Instagram", logo: <InstagramLogo size={32} /> },
  { key: "email", label: "Email / SMTP", logo: <EmailLogo size={32} /> },
  { key: "hubspot", label: "HubSpot", logo: <HubspotLogo size={32} /> },
  { key: "slack", label: "Slack", logo: <SlackLogo size={32} /> },
];

function WipSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <Wrench size={15} style={{ color: "var(--mute)", flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)", flex: 1 }}>More integrations</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)", padding: "3px 8px", borderRadius: "var(--r-pill)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
          Work in progress
        </span>
        {open ? <ChevronDown size={14} style={{ color: "var(--mute-2)", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "var(--mute-2)", flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {WIP_INTEGRATIONS.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
            >
              {s.logo}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 2 }}>Coming soon</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export function IntegrationsPanel({ account, d, onSave, fieldCols = 3, stacked = false, withVoice = true }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  withVoice?: boolean;
}) {
  const accountId = account.Id ?? account.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <IntegrationCard
        name="Twilio"
        logo={<TwilioLogo size={36} />}
        fields={d.twilio.fields}
        cols={fieldCols}
        account={account}
        onSave={onSave}
        connected={d.twilio.connected}
      />

      <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
        <CalendarConnectCard accountId={accountId} />
        <BookingPageCard accountId={accountId} />
      </div>

      {withVoice && <VoiceCloneSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} />}

      <WipSection />
    </div>
  );
}
