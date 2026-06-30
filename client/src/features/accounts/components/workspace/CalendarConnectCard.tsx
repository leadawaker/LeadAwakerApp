import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Check, Trash2, Loader2, Copy, Eye, EyeOff,
  ExternalLink, Calendar, KeyRound, ChevronDown, ChevronRight, Lock, Globe,
} from "lucide-react";
import { ConnectedPill } from "./atoms";
import {
  fetchCalendarProviders, fetchCalendarConnections, startCalendarOAuth, connectCalendarKey, connectCalendarCaldav, disconnectCalendar,
  provisionBookingPage, fetchCaldiyCredentials,
  saveCustomDomain, verifyCustomDomain, removeCustomDomain,
  type CalendarProviderId, type CalendarProviderMeta, type CalendarConnection, type CaldiyCredentials,
} from "../../api/calendarApi";
import { CalendarProviderLogo } from "./integrationLogos";
import { IntegSection, IconTile, SectionHead, FlatRow } from "./integrationsAtoms";

const CALENDAR_PROVIDER_ORDER: CalendarProviderId[] = ["google", "outlook", "calcom", "calendly", "ical"];
// Clients connect via Google/Outlook OAuth or Apple/iCal (username + app password).
const CLIENT_CALENDAR_PROVIDERS: CalendarProviderId[] = ["google", "outlook", "apple"];

// ── Calendar connect ───────────────────────────────────────────────────────────
export function CalendarConnectCard({ accountId, noBorder, clientMode }: { accountId: number; noBorder?: boolean; clientMode?: boolean }) {
  const { t } = useTranslation("accounts");
  const providerOrder = clientMode ? CLIENT_CALENDAR_PROVIDERS : CALENDAR_PROVIDER_ORDER;
  const [providers, setProviders] = useState<CalendarProviderMeta[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [provider, setProvider] = useState<CalendarProviderId>("google");
  const [secret, setSecret] = useState("");
  // Apple / CalDAV form state
  const [appleUsername, setAppleUsername] = useState("");
  const [applePassword, setApplePassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [caldavUrl, setCaldavUrl] = useState("");
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
  const isApple = provider === "apple";
  const inputStyle: React.CSSProperties = { fontSize: 11.5, padding: "8px 11px", width: "100%" };
  const visibleConnections = connections.filter(
    (c): c is CalendarConnection & { provider: CalendarProviderId } => (c.provider as string) !== "caldiy"
  );
  const hasConnections = visibleConnections.length > 0;

  const resetForm = () => {
    setSecret(""); setAppleUsername(""); setApplePassword("");
    setCaldavUrl(""); setShowAdvanced(false); setError(null);
  };

  const handleProviderChange = (p: CalendarProviderId) => {
    setProvider(p);
    resetForm();
  };

  const handleConnect = async () => {
    setError(null);
    if (meta?.authType === "oauth") { startCalendarOAuth(provider, accountId); return; }
    if (isApple) {
      if (!appleUsername || !applePassword) return;
      const kind: "apple" | "caldav" = showAdvanced && caldavUrl ? "caldav" : "apple";
      setBusy(true);
      try {
        await connectCalendarCaldav(accountId, {
          kind,
          username: appleUsername,
          password: applePassword,
          ...(kind === "caldav" ? { url: caldavUrl } : {}),
        });
        resetForm();
        setShowAddForm(false);
        await refresh();
      } catch (e: any) { setError(e.message || t("calendar.apple.connectFailed")); }
      finally { setBusy(false); }
      return;
    }
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

  const monoLabel = (text: string) => (
    <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>
      {text}
    </div>
  );

  const canSubmit = isApple ? (!!appleUsername && !!applePassword && (!showAdvanced || !!caldavUrl)) : (meta?.authType === "oauth" || !!secret);

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
          {/* Provider select */}
          <div style={{ marginBottom: 14 }}>
            {monoLabel(t("calendar.provider"))}
            <select
              className="neu-input"
              style={inputStyle}
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as CalendarProviderId)}
            >
              {providerOrder.map((p) => (
                <option key={p} value={p}>{t(`calendar.providers.${p}`)}</option>
              ))}
            </select>
          </div>

          {/* Apple / iCal form */}
          {isApple ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                {monoLabel(t("calendar.apple.appleId"))}
                <input
                  className="neu-input"
                  style={{ ...inputStyle, fontFamily: "var(--mono)" }}
                  type="email"
                  value={appleUsername}
                  onChange={(e) => setAppleUsername(e.target.value)}
                  placeholder={t("calendar.apple.appleIdPlaceholder")}
                  autoComplete="username"
                />
              </div>
              <div>
                {monoLabel(t("calendar.apple.appPassword"))}
                <input
                  className="neu-input"
                  style={{ ...inputStyle, fontFamily: "var(--mono)", letterSpacing: "0.12em" }}
                  type="password"
                  value={applePassword}
                  onChange={(e) => setApplePassword(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  autoComplete="current-password"
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--mute)", lineHeight: 1.5, margin: 0 }}>
                {t("calendar.apple.appPasswordHint")}{" "}
                <a
                  href="https://appleid.apple.com/account/manage"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--primary)", textDecoration: "underline" }}
                >
                  appleid.apple.com
                </a>
              </p>

              {/* Advanced CalDAV toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="la-btn"
                style={{ background: "transparent", boxShadow: "none", color: "var(--mute-2)", paddingLeft: 0, fontSize: 11.5, alignSelf: "flex-start" }}
              >
                {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {t("calendar.apple.advanced")}
              </button>
              {showAdvanced && (
                <div>
                  {monoLabel(t("calendar.apple.caldavUrl"))}
                  <input
                    className="neu-input"
                    style={{ ...inputStyle, fontFamily: "var(--mono)" }}
                    type="url"
                    value={caldavUrl}
                    onChange={(e) => setCaldavUrl(e.target.value)}
                    placeholder="https://caldav.example.com"
                  />
                  <p style={{ fontSize: 10.5, color: "var(--mute)", marginTop: 6, fontStyle: "italic" }}>
                    {t("calendar.apple.caldavNote")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Standard API key / URL input for non-OAuth, non-Apple providers */
            meta?.authType !== "oauth" && (
              <div style={{ marginBottom: 14 }}>
                {monoLabel(provider === "ical" ? t("calendar.url") : t("calendar.apiKey"))}
                <input
                  className="neu-input"
                  style={inputStyle}
                  type={provider === "ical" ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={provider === "ical" ? t("calendar.urlPlaceholder") : t("calendar.apiKeyPlaceholder")}
                />
              </div>
            )
          )}

          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="la-btn la-btn--soft" disabled={busy || !canSubmit} onClick={handleConnect}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : isApple ? <Lock size={12} /> : <Plus size={12} />}
              {meta?.authType === "oauth"
                ? t("calendar.connectWith", { provider: t(`calendar.providers.${provider}`) })
                : t("calendar.connect")}
            </button>
            {meta && !meta.canPush && !isApple && (
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
export function BookingPageCard({ accountId, noBorder }: { accountId: number; noBorder?: boolean }) {
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

// ── White-label booking domain ───────────────────────────────────────────────────
// Lets a client serve their booking page from their own host (book.client.com)
// via Cloudflare Tunnel. The client adds one CNAME; Gabriel adds the Public
// Hostname in Zero Trust, then marks it active here once DNS has propagated.
const BOOKING_CNAME_TARGET = "75e02640-edf0-41dd-b681-6efc0469e8e2.cfargotunnel.com";

export function CustomBookingDomainCard({ accountId, noBorder }: { accountId: number; noBorder?: boolean }) {
  const { t } = useTranslation("accounts");
  const [domain, setDomain] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [cnameTarget, setCnameTarget] = useState(BOOKING_CNAME_TARGET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    fetchCalendarConnections(accountId)
      .then((conns) => {
        const caldiy = conns.find((c) => (c.provider as string) === "caldiy");
        setDomain(caldiy?.customDomain ?? null);
        setStatus(caldiy?.customDomainStatus ?? null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [accountId]);

  if (!loaded) return null;

  const active = status === "active";
  const flatBtn = { background: "transparent", boxShadow: "none", color: "var(--mute-2)" } as React.CSSProperties;
  const monoLabel = (text: string) => (
    <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5 }}>
      {text}
    </div>
  );

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await saveCustomDomain(accountId, input.trim());
      setDomain(r.customDomain); setStatus(r.customDomainStatus); setCnameTarget(r.cnameTarget);
      setInput("");
    } catch (e: any) { setError(e.message || t("customDomain.saveFailed")); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await verifyCustomDomain(accountId);
      setStatus(r.customDomainStatus); setCnameTarget(r.cnameTarget);
      if (!r.verified) setNotice(t("customDomain.notReady"));
    } catch (e: any) { setError(e.message || t("customDomain.verifyFailed")); }
    finally { setBusy(false); }
  };

  const handleRemove = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 3000); return; }
    setBusy(true); setError(null);
    try { await removeCustomDomain(accountId); setDomain(null); setStatus(null); setDeleteConfirm(false); }
    catch (e: any) { setError(e.message || t("customDomain.removeFailed")); }
    finally { setBusy(false); }
  };

  const body = (
    <>
      <SectionHead>
        <IconTile><Globe size={16} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("customDomain.title")}</span>
        {domain ? (
          <span style={{
            fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 999,
            background: active ? "var(--good-bg, rgba(34,197,94,0.12))" : "var(--warn-bg, rgba(234,179,8,0.14))",
            color: active ? "var(--good)" : "var(--warn)",
          }}>
            {active ? t("customDomain.statusActive") : t("customDomain.statusPending")}
          </span>
        ) : (
          <ConnectedPill on={false} connectedLabel={t("pills.connected")} notSetLabel={t("pills.notSet")} />
        )}
      </SectionHead>

      {!domain ? (
        <>
          <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 14, lineHeight: 1.5 }}>{t("customDomain.explainer")}</p>
          {monoLabel(t("customDomain.domainLabel"))}
          <input
            className="neu-input"
            style={{ fontSize: 11.5, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="book.yourcompany.com"
          />
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="la-btn la-btn--soft" disabled={busy || !input.trim()} onClick={handleSave}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {t("customDomain.save")}
            </button>
            {error && <span style={{ fontSize: 11.5, color: "var(--wine)" }}>{error}</span>}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <FlatRow label={t("customDomain.domainLabel")} value={domain} />

          {!active && (
            <>
              <p style={{ fontSize: 11.5, color: "var(--mute)", margin: "12px 0 8px", lineHeight: 1.5 }}>{t("customDomain.dnsInstructions")}</p>
              <FlatRow label={t("customDomain.recordType")} value="CNAME" />
              <FlatRow label={t("customDomain.recordName")} value="book" />
              <FlatRow
                label={t("customDomain.recordTarget")}
                value={cnameTarget}
                extra={<button className="la-btn la-btn--icon" onClick={() => copy(cnameTarget)} style={flatBtn}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>}
              />
            </>
          )}

          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            {!active && (
              <button className="la-btn la-btn--soft" disabled={busy} onClick={handleVerify}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {t("customDomain.verify")}
              </button>
            )}
            {active && (
              <button className="la-btn la-btn--icon" onClick={() => window.open(`https://${domain}`, "_blank")} style={flatBtn} title={t("customDomain.openPage")}>
                <ExternalLink size={13} />
              </button>
            )}
            <button className="la-btn la-btn--soft" disabled={busy} onClick={handleRemove} style={{ color: deleteConfirm ? "var(--wine)" : undefined }}>
              <Trash2 size={12} />
              {deleteConfirm ? t("detail.confirm") : t("customDomain.remove")}
            </button>
            {notice && <span style={{ fontSize: 11.5, color: "var(--warn)" }}>{notice}</span>}
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
export function BookingLinkReadOnly({ accountId, noBorder }: { accountId: number; noBorder?: boolean }) {
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
