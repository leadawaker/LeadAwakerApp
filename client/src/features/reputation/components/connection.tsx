// Live connection + saved switches for the Reputation Settings tab: which
// account, its Google Business Profile connection and location, and the two
// account flags the reviews poller reads. Backed by the reviews API.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace, type Account } from "@/hooks/useWorkspace";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { apiFetch } from "@/lib/apiUtils";
import {
  disconnectReviews,
  fetchReviewLocations,
  fetchReviewsConnection,
  pollReviewsNow,
  selectReviewLocation,
  startReviewsOAuth,
  type ReviewLocation,
  type ReviewsConnection,
} from "@/features/accounts/api/reviewsApi";
import ReputationSettingsPanel from "@/features/accounts/components/ReputationSettingsPanel";
import { RIconExt, RIconRefresh, RepPlatformGlyph } from "./atoms";
import { RepSettingRow, RepSettingsPanel, RepToggle } from "./settings";

const readEnabled = (a: Record<string, any>) => Boolean(a.enable_review_response ?? a.enableReviewResponse);
const readAutoPositive = (a: Record<string, any>) => Boolean(a.review_reply_auto_positive ?? a.reviewReplyAutoPositive);

export function RepLiveConnection({ initialAccountId, onChanged }: {
  /** Account to open on in agency view (e.g. the one just connected via OAuth). */
  initialAccountId?: number;
  /** Called after anything that changes what the inbox should show. */
  onChanged: () => void;
}) {
  const { t } = useTranslation("accounts");
  const { toast } = useToast();
  const { currentAccountId, accounts } = useWorkspace();

  // Scoped to one account in the nav bar: use it. Agency view: pick one here; the last pick is kept
  // in this browser for the next visit (an account from a link, e.g. after OAuth, still wins).
  const scoped = currentAccountId > 0;
  const [picked, setPicked] = useState<number>(initialAccountId || 0);
  const [remembered, setRemembered] = usePersistedSelection<Account>("reputation-settings-account", (a) => a.id, accounts);
  const accountId = scoped ? currentAccountId : picked || remembered?.id || accounts[0]?.id || 0;
  const chooseAccount = (id: number) => {
    setPicked(id);
    const chosen = accounts.find((a) => a.id === id);
    if (chosen) setRemembered(chosen);
  };

  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const [conn, setConn] = useState<ReviewsConnection | null>(null);
  const [locations, setLocations] = useState<ReviewLocation[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [autoPositive, setAutoPositive] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadConnection = useCallback(() => {
    if (!accountId) return;
    fetchReviewsConnection(accountId)
      .then(setConn)
      .catch(() => toast({ description: t("reviewResponse.connectionError"), variant: "destructive" }));
  }, [accountId, t, toast]);

  useEffect(() => {
    if (!accountId) return;
    setAccount(null); setConn(null); setLocations(null);
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!a) return;
        setAccount(a);
        setEnabled(readEnabled(a));
        setAutoPositive(readAutoPositive(a));
      })
      .catch(() => {});
    loadConnection();
  }, [accountId, loadConnection]);

  // Persist the two account flags together.
  const saveFlags = async (next: { enabled?: boolean; autoPositive?: boolean }) => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable_review_response: next.enabled ?? enabled,
          review_reply_auto_positive: next.autoPositive ?? autoPositive,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ description: t("reviewResponse.saved") });
      onChanged();
    } catch {
      toast({ description: t("reviewResponse.saveError"), variant: "destructive" });
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const handleLoadLocations = () => withBusy(async () => {
    try {
      setLocations(await fetchReviewLocations(accountId));
    } catch (e: any) {
      toast({ description: e.message || t("reviewResponse.locationsError"), variant: "destructive" });
    }
  });

  const handleSelectLocation = (loc: ReviewLocation) => withBusy(async () => {
    try {
      await selectReviewLocation(accountId, loc);
      setLocations(null);
      loadConnection();
      onChanged();
      toast({ description: t("reviewResponse.locationSet") });
    } catch {
      toast({ description: t("reviewResponse.saveError"), variant: "destructive" });
    }
  });

  const handleDisconnect = () => withBusy(async () => {
    try {
      await disconnectReviews(accountId);
      setLocations(null);
      loadConnection();
      onChanged();
    } catch {
      toast({ description: t("reviewResponse.saveError"), variant: "destructive" });
    }
  });

  const handleRefresh = () => withBusy(async () => {
    try {
      await pollReviewsNow(accountId);
      onChanged();
      toast({ description: t("reviewResponse.refreshed") });
    } catch (e: any) {
      toast({ description: e.message || t("reviewResponse.refreshError"), variant: "destructive" });
    }
  });

  const connected = !!conn?.connected;
  const locationSelected = !!conn?.locationSelected;
  const googleDesc = !connected
    ? t("reviewResponse.notConnected")
    : locationSelected
      ? `${t("reviewResponse.monitoring")}: ${conn?.displayName || conn?.locationName || ""}`
      : t("reviewResponse.pickLocationHint", { email: conn?.displayName || "" });

  return (
    <>
      <RepSettingsPanel eyebrow={t("reviewResponse.title")} accent={connected ? "var(--good)" : "var(--line-strong)"}
        title={t("reviewResponse.connectTitle")}
        desc={t("reviewResponse.description")}>

        {!scoped && (
          <RepSettingRow title={t("reviewResponse.accountLabel")} desc={t("reviewResponse.accountHint")}>
            <select className="neu-input" value={accountId} onChange={(e) => chooseAccount(Number(e.target.value))}
              style={{ fontSize: 12.5, padding: "7px 10px", background: "var(--bg)", color: "var(--ink)", minWidth: 200 }}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </RepSettingRow>
        )}

        <RepSettingRow title={t("reviewResponse.enableLabel")} desc={t("reviewResponse.enableHint")}>
          <RepToggle on={enabled} onChange={(v) => { setEnabled(v); saveFlags({ enabled: v }); }} />
        </RepSettingRow>

        <div style={enabled ? undefined : { opacity: 0.5, pointerEvents: "none" }}>
          <RepSettingRow title="Google" desc={googleDesc}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <RepPlatformGlyph size={18} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: connected ? "var(--good)" : "var(--mute-2)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: connected ? "var(--good)" : "var(--mute-2)" }} />
                  {connected ? t("reviewResponse.connected") : t("reviewResponse.notConnected")}
                </span>
              </span>
              {!connected && (
                <button onClick={() => startReviewsOAuth(accountId)} disabled={!accountId} className="la-btn la-btn--wine"><RIconExt size={13} />{t("reviewResponse.connect")}</button>
              )}
              {connected && !locationSelected && locations === null && (
                <button onClick={handleLoadLocations} disabled={busy} className="la-btn la-btn--wine">{t("reviewResponse.loadLocations")}</button>
              )}
              {connected && locationSelected && (
                <button onClick={handleRefresh} disabled={busy} className="la-btn la-btn--soft"><RIconRefresh size={13} />{t("reviewResponse.refresh")}</button>
              )}
              {connected && (
                <button onClick={handleDisconnect} disabled={busy} className="la-btn la-btn--soft">{t("reviewResponse.disconnect")}</button>
              )}
            </div>
          </RepSettingRow>

          {connected && !locationSelected && locations !== null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0 14px", borderBottom: "1px solid var(--line)" }}>
              {locations.length === 0
                ? <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("reviewResponse.noLocations")}</span>
                : locations.map((loc) => (
                    <button key={loc.name} onClick={() => handleSelectLocation(loc)} disabled={busy} className="la-btn la-btn--inset" style={{ justifyContent: "flex-start", textAlign: "left" }}>{loc.title}</button>
                  ))}
            </div>
          )}

          <RepSettingRow title={t("reviewResponse.autoPositiveLabel")} desc={t("reviewResponse.autoPositiveHint")} last>
            <RepToggle on={autoPositive} onChange={(v) => { setAutoPositive(v); saveFlags({ autoPositive: v }); }} />
          </RepSettingRow>
        </div>
      </RepSettingsPanel>

      {/* Feedback-request settings (review link, alert target): the existing account panel. */}
      {account && (
        <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 24px" }}>
          <ReputationSettingsPanel account={account} accountId={accountId} />
        </div>
      )}
    </>
  );
}
