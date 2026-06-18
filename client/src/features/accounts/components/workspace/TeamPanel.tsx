import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, UserPlus, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";
import { Panel, PanelAction, Avatar, RolePill } from "./atoms";
import type { TeamMemberData } from "./types";

const ROUTE_PREFIX = "/platform";

interface AllUser {
  id: number;
  name: string;
  email: string;
  role: string;
  accountId: number | null;
  accountName?: string;
}

function userAccountId(u: any): number | null {
  const id = u.accountsId ?? u.Accounts_id ?? u.accounts_id ?? u.account_id;
  return typeof id === "number" ? id : id ? Number(id) : null;
}

function TeamRow({ m, onOpen }: { m: TeamMemberData; onOpen: () => void }) {
  const isOwner = m.role === "Owner" || m.role === "Admin";
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 12px", borderRadius: "var(--r-surface)", cursor: "pointer", transition: "background 130ms" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Avatar init={m.init} size={38} tone={isOwner ? "wine" : "bark"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
        {m.email && <div style={{ fontSize: 11.5, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>}
      </div>
      {m.role && <RolePill role={m.role} />}
    </div>
  );
}

function InvitePopover({ accountId, onAssigned }: { accountId: number; onAssigned: () => void }) {
  const { t } = useTranslation("accounts");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AllUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/users");
      const data = await res.json();
      const list: any[] = Array.isArray(data) ? data : data?.list ?? data?.data ?? [];
      setUsers(list.map((u) => ({
        id: u.id ?? u.Id,
        name: u.fullName1 ?? u.full_name_1 ?? u.name ?? u.email ?? "—",
        email: u.email ?? "",
        role: u.role ?? "",
        accountId: userAccountId(u),
        accountName: u.accountName ?? u.account_name,
      })));
    } catch { setUsers([]); }
    finally { setLoading(false); }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && users === null) load();
  };

  const assign = async (userId: number) => {
    setBusyId(userId);
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      onAssigned();
      setOpen(false);
      setUsers(null);
    } catch (e) { console.error("Assign user failed", e); }
    finally { setBusyId(null); }
  };

  const assignable = (users ?? []).filter((u) => u.accountId !== accountId);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className="la-btn la-btn--soft"><Plus size={12} />{t("panels.actions.invite")}</button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-72 p-0 bg-white" style={{ maxHeight: 340, overflowY: "auto" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)" }}>
          {t("panels.invite.title")}
        </div>
        {loading ? (
          <div style={{ padding: "18px 12px", textAlign: "center", color: "var(--mute-2)", fontSize: 12 }}>{t("panels.invite.loading")}</div>
        ) : assignable.length === 0 ? (
          <div style={{ padding: "18px 12px", textAlign: "center", color: "var(--mute-2)", fontSize: 12, fontStyle: "italic" }}>{t("panels.invite.empty")}</div>
        ) : (
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            {assignable.map((u) => (
              <button
                key={u.id}
                onClick={() => assign(u.id)}
                disabled={busyId !== null}
                className="row"
                style={{ gap: 10, padding: "8px 10px", borderRadius: "var(--r-surface)", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <UserPlus size={15} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.role}{u.accountName ? ` · ${u.accountName}` : ""}
                  </div>
                </div>
                {busyId === u.id && <Check size={14} style={{ color: "var(--wine)" }} />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TeamPanel({ team, loading, accountId, onRefresh }: { team: TeamMemberData[]; loading?: boolean; accountId: number; onRefresh?: () => void }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();

  const openMember = (id: number) => {
    try {
      sessionStorage.setItem("pendingSettingsSection", "team");
      if (id) sessionStorage.setItem("pendingUserSelection", String(id));
    } catch {}
    setLocation(`${ROUTE_PREFIX}/settings`);
  };

  return (
    <Panel eyebrow="03" title={t("panels.team")} count={t("metrics.nMembers", { count: team.length })}
      action={<InvitePopover accountId={accountId} onAssigned={() => onRefresh?.()} />}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1].map((i) => <div key={i} style={{ height: 44, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} className="animate-pulse" />)}
        </div>
      ) : team.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--mute-2)", fontStyle: "italic", padding: "6px 2px" }}>{t("related.noUsersAssigned")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {team.map((m) => <TeamRow key={m.id} m={m} onOpen={() => openMember(m.id)} />)}
        </div>
      )}
    </Panel>
  );
}
