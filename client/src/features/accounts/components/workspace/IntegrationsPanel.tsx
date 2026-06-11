import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Plus, RefreshCw, Check, X } from "lucide-react";
import { Panel, PanelAction, GroupLabel, BrandTile, ConnectedPill, IntegrationField, EditButton } from "./atoms";
import { useAccountEdit } from "./useAccountEdit";
import { VoiceCloneSection } from "./VoiceCloneSection";
import { syncInstagramContacts } from "../../api/accountsApi";
import type { AccountRow, AccountDetail, IntegrationField as IField } from "./types";

const COMING_SOON = [
  { key: "email", label: "Email / SMTP", init: "@" },
  { key: "calendar", label: "Calendar", init: "C" },
  { key: "hubspot", label: "HubSpot", init: "H" },
  { key: "slack", label: "Slack", init: "S" },
];

function EditFieldInput({ value, onChange, secret }: { value: string; onChange: (v: string) => void; secret?: boolean }) {
  return <input className="neu-input" style={{ fontSize: 11.5, padding: "8px 11px", width: "100%", fontFamily: "var(--mono)" }} type={secret ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function IntegrationCard({ name, init, fields, cols, account, onSave, connected, extra }: {
  name: string; init: string; fields: IField[]; cols: number; account: AccountRow;
  onSave: (field: string, value: string) => Promise<void>; connected: boolean; extra?: React.ReactNode;
}) {
  const { t } = useTranslation("accounts");
  const { isEditing, saving, startEdit, cancelEdit, set, val, save } = useAccountEdit(account, onSave);
  return (
    <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 18 }}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <BrandTile init={init} size={36} connected={connected} />
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
    </div>
  );
}

function InstagramSync({ account }: { account: AccountRow }) {
  const { t } = useTranslation("accounts");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const id = account.Id ?? account.id ?? 0;
  const canSync = !!account.instagram_user_id && !!account.instagram_access_token;
  if (!canSync) return null;

  const run = async () => {
    setSyncing(true); setResult(null); setError(null);
    try { setResult(await syncInstagramContacts(id)); }
    catch (e: any) { setError(e.message || "Sync failed"); }
    finally { setSyncing(false); }
  };

  return (
    <div style={{ marginTop: 14 }} className="space-y-2">
      <button className="la-btn la-btn--soft" disabled={syncing} onClick={run}>
        <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
        {syncing ? t("detail.syncingContacts") : t("detail.syncInstagram")}
      </button>
      {result && (
        <div style={{ marginTop: 8, borderRadius: "var(--r-button)", background: "var(--good-tint)", padding: "8px 11px", fontSize: 11.5, color: "var(--good)" }}>
          <p style={{ fontWeight: 600 }}>{t("detail.contactsSynced", { count: result.synced })}</p>
          {result.skipped_duplicates > 0 && <p>{t("detail.alreadyExisted", { count: result.skipped_duplicates })}</p>}
          {result.failed > 0 && <p style={{ color: "var(--warn)" }}>{t("detail.failedCount", { count: result.failed })}</p>}
          {result.rate_limited && <p style={{ color: "var(--warn)" }}>{t("detail.rateLimited")}</p>}
          <p style={{ opacity: 0.75 }}>{t("detail.conversationsScanned", { count: result.total_conversations })}</p>
        </div>
      )}
      {error && <div style={{ marginTop: 8, borderRadius: "var(--r-button)", background: "var(--wine-tint)", padding: "8px 11px", fontSize: 11.5, color: "var(--wine)" }}>{error}</div>}
    </div>
  );
}

export function IntegrationsPanel({ account, d, onSave, fieldCols = 3, stacked = false, withVoice = true }: {
  account: AccountRow;
  d: AccountDetail;
  onSave: (field: string, value: string) => Promise<void>;
  fieldCols?: number;
  stacked?: boolean;
  withVoice?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const connectedCount = (d.twilio.connected ? 1 : 0) + (d.instagram.connected ? 1 : 0);

  return (
    <Panel icon={<Link2 size={16} />} title={t("panels.integrations")} count={t("pills.nConnected", { count: connectedCount })}
      action={<PanelAction icon={<Plus size={12} />}>{t("panels.actions.addIntegration")}</PanelAction>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <IntegrationCard name="Twilio" init="T" fields={d.twilio.fields} cols={fieldCols} account={account} onSave={onSave} connected={d.twilio.connected} />
        <div style={{ display: stacked ? "flex" : "grid", flexDirection: stacked ? "column" : undefined, gridTemplateColumns: stacked ? undefined : "1.1fr 1fr", gap: 16, alignItems: "start" }}>
          <IntegrationCard name="Instagram" init="Ig" fields={d.instagram.fields} cols={2} account={account} onSave={onSave} connected={d.instagram.connected} extra={<InstagramSync account={account} />} />
          <div>
            <GroupLabel>{t("panels.available")}</GroupLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {COMING_SOON.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
                  <BrandTile init={s.init} size={32} connected={false} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 2 }}>{t("pills.comingSoon")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {withVoice && <VoiceCloneSection account={account} voices={d.voices} onSave={onSave} stacked={stacked} />}
      </div>
    </Panel>
  );
}
