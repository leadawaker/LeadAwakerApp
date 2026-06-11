import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { Panel, PanelAction, Avatar, RolePill } from "./atoms";
import type { TeamMemberData } from "./types";

const ROUTE_PREFIX = "/platform";

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

export function TeamPanel({ team, loading, onInvite }: { team: TeamMemberData[]; loading?: boolean; onInvite?: () => void }) {
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
      action={<PanelAction icon={<Plus size={12} />} onClick={onInvite ?? (() => openMember(0))}>{t("panels.actions.invite")}</PanelAction>}>
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
