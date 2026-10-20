// The Instagram card in the Integrations tab's Social group (and on the Social tab when nothing is
// connected). Three states: not connected (Connect), connected (@username, Disconnect with an
// in-app confirm), needs attention (the reason, Reconnect). Agency also gets the per-account
// switch that shows Social to the client. Only agency and the account's Managers get buttons.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ArrowRight, Instagram, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ConnectedPill } from "@/features/accounts/components/workspace/atoms";
import { IconTile, SectionHead } from "@/features/accounts/components/workspace/integrationsAtoms";
import { disconnectInstagram, fetchSocialStatus, setSocialEnabled, socialStatusKey, startInstagramConnect } from "../api/socialApi";
import { canActOnSocial, connectCardMode } from "../lib/socialState";
import { SOCIAL_PAGE_PATH } from "../lib/socialPage";

const cardStyle: React.CSSProperties = { borderRadius: "var(--r-card)", padding: "22px 24px", background: "var(--bone)" };
const lineStyle: React.CSSProperties = { fontSize: 12.5, color: "var(--mute)", lineHeight: 1.5, margin: 0 };

export function useSocialStatus(accountId: number) {
  return useQuery({
    queryKey: socialStatusKey(accountId),
    queryFn: () => fetchSocialStatus(accountId),
    enabled: accountId > 0,
    staleTime: 30_000,
  });
}

/** Agency only: whether the client sees the Social group and tab. */
function SocialSwitchRow({ accountId, enabled }: { accountId: number; enabled: boolean }) {
  const { t } = useTranslation("accounts");
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (next: boolean) => setSocialEnabled(accountId, next),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: socialStatusKey(accountId) });
      // The Socials page's account picker lists the accounts with Social on.
      qc.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });
  return (
    <div className="row" style={{ gap: 12, padding: "14px 0 0", marginTop: 16, borderTop: "1.5px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{t("social.connect.enableTitle")}</div>
        <p style={{ ...lineStyle, fontSize: 11.5 }}>{t("social.connect.enableHelp")}</p>
        {toggle.isError && <p style={{ ...lineStyle, fontSize: 11.5, color: "hsl(var(--destructive))" }}>{t("social.connect.enableFailed")}</p>}
      </div>
      <Switch
        checked={enabled}
        disabled={toggle.isPending}
        onCheckedChange={(v) => toggle.mutate(v)}
        aria-label={t("social.connect.enableTitle")}
        data-testid="social-enabled-switch"
      />
    </div>
  );
}

/** "Go to Socials": shown on the connected card in Integrations, not on the Socials page itself. */
export function InstagramConnectCard({ accountId, showSocialsLink = true }: { accountId: number; showSocialsLink?: boolean }) {
  const { t } = useTranslation("accounts");
  const { isAgencyUser, userRole } = useWorkspace();
  const qc = useQueryClient();
  const { data: status, isLoading } = useSocialStatus(accountId);
  const [confirming, setConfirming] = useState(false);
  const canAct = canActOnSocial({ isAgency: isAgencyUser, userRole });
  const mode = connectCardMode(status);
  const conn = status?.connection ?? null;

  const disconnect = useMutation({
    mutationFn: () => disconnectInstagram(accountId),
    onSuccess: () => setConfirming(false),
    onSettled: () => qc.invalidateQueries({ queryKey: socialStatusKey(accountId) }),
  });

  const connectBtn = (labelKey: "connectButton" | "reconnectButton") => (
    <button
      type="button"
      className="la-btn la-btn--wine"
      onClick={() => startInstagramConnect(accountId)}
      data-testid="instagram-connect"
    >
      <Instagram size={14} />
      {t(`social.connect.${labelKey}`)}
    </button>
  );

  return (
    <div className="neu-raised" style={cardStyle} data-testid="instagram-connect-card">
      <SectionHead>
        <IconTile><Instagram size={18} style={{ color: "var(--mute-2)" }} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("social.connect.title")}</span>
        <ConnectedPill on={mode === "connected"} connectedLabel={t("social.connect.connected")} notSetLabel={t(mode === "needs_attention" ? "social.connect.needsAttention" : "social.connect.notConnected")} />
      </SectionHead>

      {isLoading ? (
        <span role="status" aria-label={t("social.connect.loading")}>
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        </span>
      ) : mode === "connected" && conn ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            {conn.profilePictureUrl ? (
              <img src={conn.profilePictureUrl} alt="" width={36} height={36} style={{ borderRadius: "var(--r-pill)", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <IconTile><Instagram size={16} /></IconTile>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                @{conn.username}
              </div>
              <p style={{ ...lineStyle, fontSize: 11.5 }}>{t("social.connect.renews")}</p>
            </div>
          </div>
          {!confirming && (canAct || showSocialsLink) && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {showSocialsLink && (status?.enabled || isAgencyUser) && (
                <Link href={SOCIAL_PAGE_PATH} className="la-btn la-btn--wine" data-testid="instagram-go-to-socials">
                  {t("social.connect.goToSocials")}
                  <ArrowRight size={14} />
                </Link>
              )}
              {canAct && (
                <button type="button" className="la-btn la-btn--soft" onClick={() => setConfirming(true)} data-testid="instagram-disconnect">
                  {t("social.connect.disconnect")}
                </button>
              )}
            </div>
          )}
          {canAct && confirming && (
            <div className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ ...lineStyle, color: "var(--ink-soft)" }}>{t("social.connect.disconnectConfirm")}</p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="la-btn la-btn--wine" disabled={disconnect.isPending} onClick={() => disconnect.mutate()} data-testid="instagram-disconnect-confirm">
                  {disconnect.isPending && <Loader2 size={12} className="animate-spin" />}
                  {t("social.connect.disconnectYes")}
                </button>
                <button type="button" className="la-btn la-btn--plain" disabled={disconnect.isPending} onClick={() => setConfirming(false)}>
                  {t("social.connect.cancel")}
                </button>
              </div>
              {disconnect.isError && <p style={{ ...lineStyle, color: "hsl(var(--destructive))" }}>{t("social.connect.disconnectFailed")}</p>}
            </div>
          )}
        </div>
      ) : mode === "needs_attention" && conn ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ ...lineStyle, color: "var(--ink-soft)" }}>
            {conn.username ? t("social.connect.attentionHelpNamed", { username: conn.username }) : t("social.connect.attentionHelp")}
          </p>
          {isAgencyUser && conn.lastError && <p style={{ ...lineStyle, fontFamily: "var(--mono)", fontSize: 11 }}>{conn.lastError}</p>}
          {canAct && <div>{connectBtn("reconnectButton")}</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={lineStyle}>{t("social.connect.requirement")}</p>
          {canAct ? <div>{connectBtn("connectButton")}</div> : <p style={{ ...lineStyle, fontSize: 11.5 }}>{t("social.connect.askManager")}</p>}
        </div>
      )}

      {isAgencyUser && status && <SocialSwitchRow accountId={accountId} enabled={status.enabled} />}
    </div>
  );
}
