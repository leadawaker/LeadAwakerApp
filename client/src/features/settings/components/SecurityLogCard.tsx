import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { SettingsCard } from "./SettingsCard";
import { browserLabel } from "../twoFactor/DevicesList";
import { inputStyle } from "../twoFactor/TwoFactorPrimitives";
import { twoFactorRequest } from "../twoFactor/useTwoFactor";

type Ev = {
  id: number; usersId: number | null; actorUsersId: number | null; event: string; ip: string | null;
  userAgent: string | null; meta: Record<string, unknown> | null; createdAt: string;
};
type Page = { events: Ev[]; users: Record<number, { name: string; email: string }>; nextBefore: number | null };

const EVENT_NAMES = [
  "login_success", "login_failed", "login_rate_limited", "challenge_started", "challenge_success", "challenge_failed",
  "challenge_locked", "method_enabled", "method_disabled", "email_code_sent", "backup_codes_generated", "backup_code_used",
  "trusted_device_added", "trusted_device_used", "trusted_device_revoked", "passkey_added", "passkey_removed",
  "password_changed", "admin_reset", "policy_changed", "enrollment_forced",
] as const;
const BAD = new Set(["login_failed", "login_rate_limited", "challenge_failed", "challenge_locked", "admin_reset"]);

/** Owner only: the security audit log, newest first, 50 rows per page. */
export function SecurityLogCard({ flat = false }: { flat?: boolean }) {
  const { t } = useTranslation("settings");
  const [events, setEvents] = useState<Ev[]>([]);
  const [users, setUsers] = useState<Page["users"]>({});
  const [next, setNext] = useState<number | null>(null);
  const [event, setEvent] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (before?: number) => {
    setLoading(true);
    const q = new URLSearchParams({ limit: "50" });
    if (event) q.set("event", event);
    if (userId) q.set("userId", userId);
    if (from) q.set("from", new Date(from).toISOString());
    if (to) q.set("to", new Date(new Date(to).getTime() + 86_400_000).toISOString());
    if (before) q.set("before", String(before));
    const r = await twoFactorRequest<Page>("GET", `/api/admin/security-events?${q}`);
    setLoading(false);
    if (!r.ok) return;
    setEvents((prev) => (before ? [...prev, ...r.data.events] : r.data.events));
    setUsers((prev) => ({ ...prev, ...r.data.users }));
    setNext(r.data.nextBefore);
  }, [event, userId, from, to]);

  useEffect(() => { void load(); }, [load]);

  const who = (id: number | null) => (id ? users[id]?.name || users[id]?.email || `#${id}` : "");
  const meta = (m: Ev["meta"]) => (m ? Object.entries(m).filter(([k, v]) => k !== "email_hash" && v !== null && v !== undefined).map(([k, v]) => `${k}: ${v}`).join(", ") : "");
  const field = "h-9 w-full text-sm neu-inset-crisp px-2 text-foreground";

  return (
    <SettingsCard icon={ScrollText} title={t("securityLog.title")} description={t("securityLog.description")} flat={flat} data-testid="section-security-log">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select value={event} onChange={(e) => setEvent(e.target.value)} className={field} style={inputStyle} data-testid="select-log-event">
          <option value="">{t("securityLog.allEvents")}</option>
          {EVENT_NAMES.map((n) => <option key={n} value={n}>{t(`securityLog.events.${n}`)}</option>)}
        </select>
        <input value={userId} onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))} placeholder={t("securityLog.userId")} className={field} style={inputStyle} data-testid="input-log-user" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("securityLog.from")} className={field} style={inputStyle} data-testid="input-log-from" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("securityLog.to")} className={field} style={inputStyle} data-testid="input-log-to" />
      </div>

      <div className="divide-y divide-border rounded-lg border border-border" data-testid="list-security-events">
        {events.length === 0 && !loading && <div className="px-3 py-4 text-sm text-muted-foreground">{t("securityLog.empty")}</div>}
        {events.map((e) => (
          <div key={e.id} className="px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill color={BAD.has(e.event) ? "hsl(var(--destructive))" : undefined}>{t(`securityLog.events.${e.event}`, e.event)}</Pill>
              <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <div className="text-sm text-foreground">
              {who(e.usersId) || t("securityLog.unknownUser")}
              {e.actorUsersId && e.actorUsersId !== e.usersId ? <span className="text-muted-foreground"> {t("securityLog.by", { name: who(e.actorUsersId) })}</span> : null}
            </div>
            <div className="text-xs text-muted-foreground break-words">
              {[e.ip, browserLabel(e.userAgent), meta(e.meta)].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>

      {next && (
        <button type="button" onClick={() => void load(next)} disabled={loading} className="la-btn la-btn--soft la-btn--lg disabled:opacity-50" data-testid="button-log-more">
          {t("securityLog.loadMore")}
        </button>
      )}
    </SettingsCard>
  );
}
