import { useState, useCallback, useEffect } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { getInitials, getUserRoleAvatarColor } from "@/lib/avatarUtils";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

// ── AccountUsersPanel ──────────────────────────────────────────────────────────

export function AccountUsersPanel({ accountId, routePrefix }: { accountId: number; routePrefix: string }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker state
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [allUsers, setAllUsers]           = useState<any[]>([]);
  const [pickerSearch, setPickerSearch]   = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigning, setAssigning]         = useState<number | null>(null);

  const refreshUsers = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data: any) => {
        const all: any[] = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
        setUsers(all.filter((u: any) => {
          const uid = u.accountsId ?? u.Accounts_id ?? u.accounts_id ?? u.account_id;
          return uid === accountId;
        }));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res  = await apiFetch("/api/users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.list ?? data?.data ?? []);
      setAllUsers(list);
    } catch {
      setAllUsers([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleAssign = useCallback(async (user: any) => {
    const uid = user.id ?? user.Id;
    if (!uid) return;
    setAssigning(uid);
    try {
      await apiFetch(`/api/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      setPickerOpen(false);
      refreshUsers();
    } catch (e) {
      console.error("Failed to assign user", e);
    } finally {
      setAssigning(null);
    }
  }, [accountId, refreshUsers]);

  const alreadyAssignedIds = new Set(users.map((u: any) => u.id ?? u.Id));
  const pickerFiltered = allUsers
    .filter((u: any) => !alreadyAssignedIds.has(u.id ?? u.Id))
    .filter((u: any) => {
      if (!pickerSearch.trim()) return true;
      const name = u.full_name ?? u.name ?? u.email ?? "";
      return name.toLowerCase().includes(pickerSearch.toLowerCase());
    });

  return (
    <div>

      {/* User picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("related.addUser")}</DialogTitle>
            <DialogDescription>{t("related.pickUser")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder={t("related.searchUsers")}
              className="w-full text-[12px] bg-white dark:bg-popover border border-border/40 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="max-h-60 overflow-y-auto">
              {pickerLoading ? (
                <div className="space-y-1.5 py-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
                </div>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-[12px] text-foreground/40 italic py-6 text-center">{t("related.noUsersAvailable")}</p>
              ) : (
                <div className="space-y-0.5">
                  {pickerFiltered.map((u: any) => {
                    const uid   = u.id ?? u.Id;
                    const name  = u.full_name ?? u.name ?? u.email ?? t("related.unknown");
                    const email = u.email ?? "";
                    const role  = u.role ?? u.Role ?? "";
                    return (
                      <button
                        key={uid}
                        onClick={() => handleAssign(u)}
                        disabled={assigning === uid}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-foreground font-medium truncate">{name}</p>
                          {email && name !== email && (
                            <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                          )}
                        </div>
                        {role && (
                          <span className="text-[10px] text-foreground/50 shrink-0 bg-black/[0.05] rounded-full px-1.5 py-0.5">{role}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("related.members")}</span>
        {!loading && (
          <span className="text-[10px] font-semibold text-foreground/40 bg-black/[0.05] rounded-full px-1.5 py-0.5">{users.length}</span>
        )}
        <button
          onClick={openPicker}
          title={t("related.addUser")}
          className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-black/[0.06] hover:bg-brand-indigo hover:text-white text-foreground/50 transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-black/[0.05] animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-[11px] text-foreground/30 italic">{t("related.noUsersAssigned")}</p>
      ) : (
        <ul className="space-y-0">
          {[...users].sort((a: any, b: any) => {
            const roleOrder: Record<string, number> = { Admin: 0, Operator: 1, Manager: 2, Agent: 3, Viewer: 4 };
            const ra = roleOrder[a.role ?? a.Role ?? ""] ?? 5;
            const rb = roleOrder[b.role ?? b.Role ?? ""] ?? 5;
            return ra - rb;
          }).map((u: any, i: number) => {
            const name    = u.full_name ?? u.fullName1 ?? u.name ?? u.email ?? u.username ?? t("related.unknown");
            const email   = u.email ?? "";
            const role    = u.role ?? u.Role ?? "";
            const uid     = u.id ?? u.Id;
            const photo   = u.avatarUrl ?? u.avatar_url ?? null;
            const colors  = getUserRoleAvatarColor(role);
            const inits   = getInitials(name);
            // Role → ring color
            const ringColor: Record<string, string> = {
              Admin:    "#B45309",
              Operator: "#C2410C",
              Manager:  "#1D4ED8",
              Agent:    "#6D28D9",
              Viewer:   "#6B7280",
            };
            const ring = ringColor[role] ?? "#9CA3AF";
            return (
              <li
                key={uid ?? i}
                className="flex items-center gap-2 py-1.5 px-2 -mx-2 border-b border-border/15 last:border-0 cursor-pointer rounded-lg hover:bg-black/[0.04] transition-colors duration-100"
                onClick={() => {
                  sessionStorage.setItem("pendingSettingsSection", "team");
                  if (uid) sessionStorage.setItem("pendingUserSelection", String(uid));
                  setLocation(`${routePrefix}/settings`);
                }}
              >
                <div
                  className="h-[34px] w-[34px] rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden"
                  style={photo
                    ? { outline: `2.5px solid ${ring}`, outlineOffset: "1.5px" }
                    : { backgroundColor: colors.bg, color: colors.text, outline: `2.5px solid ${ring}`, outlineOffset: "1.5px" }
                  }
                >
                  {photo
                    ? <img src={photo} alt={name} className="h-full w-full object-cover" />
                    : (inits || "?")
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground truncate">{name}</p>
                  {email && name !== email && (
                    <p className="text-[10px] text-foreground/40 truncate">{email}</p>
                  )}
                </div>
                {role && (
                  <span
                    className="text-[10px] font-semibold shrink-0 rounded-full px-1.5 py-0.5"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >{role}</span>
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
