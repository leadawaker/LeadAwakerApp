import { Users, Check } from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { ROLE_AVATAR } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";
import type { UserTableItem } from "./UsersInlineTable";
import type { AppUser, AccountMap } from "../types";

function getUserName(u: AppUser) {
  return u.fullName1 || u.email || `User #${u.id}`;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function CardGridSkeleton() {
  return (
    <div
      className="grid gap-3 p-3.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] bg-primary/10 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

interface UsersCardGridProps {
  flatItems: UserTableItem[];
  loading: boolean;
  accounts: AccountMap;
  selectedUserId: number | null;
  onSelectUser: (user: AppUser) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  /** Multi-select (bulk actions) is an Owner-only capability — Admins and other users never see it */
  canMultiSelect: boolean;
}

export function UsersCardGrid({
  flatItems, loading, accounts, selectedUserId, onSelectUser, selectedIds, onToggleSelect, canMultiSelect,
}: UsersCardGridProps) {
  if (loading) return <CardGridSkeleton />;

  const userCount = flatItems.filter((i) => i.kind === "user").length;
  if (userCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <Users className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">No users found</p>
      </div>
    );
  }

  // Build sections: each group header starts a new section
  const sections: { label: string | null; count: number; users: AppUser[] }[] = [];
  let current: { label: string | null; count: number; users: AppUser[] } | null = null;
  for (const item of flatItems) {
    if (item.kind === "header") {
      current = { label: item.label, count: item.count, users: [] };
      sections.push(current);
    } else {
      if (!current) { current = { label: null, count: 0, users: [] }; sections.push(current); }
      current.users.push(item.user);
    }
  }

  let cardIdx = 0;
  return (
    <div className="overflow-y-auto p-3.5 space-y-5" data-testid="users-card-grid">
      {sections.map((section, si) => {
        if (section.users.length === 0) return null;
        return (
          <div key={section.label ?? `s-${si}`} className="space-y-2">
            {section.label !== null && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </span>
                <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                  {section.users.length}
                </span>
              </div>
            )}
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {section.users.map((u) => {
                const role = u.role || "Viewer";
                const color = ROLE_AVATAR[role] ?? ROLE_AVATAR.Viewer;
                const accountName = u.accountsId ? (accounts[u.accountsId] || `Account #${u.accountsId}`) : null;
                const isSelected = selectedUserId === u.id;
                const isChecked = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onSelectUser(u)}
                    className={cn(
                      "flex flex-row items-center gap-3 px-3 py-3 rounded-xl text-left",
                      "transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 animate-card-enter",
                      isSelected ? "neu-raised-crisp" : "bg-card",
                    )}
                    style={{
                      animationDelay: `${Math.min(cardIdx++, 15) * 30}ms`,
                      ...(isSelected
                        ? { outline: "2px solid var(--wine)", outlineOffset: "0px", background: "var(--card)" }
                        : { boxShadow: "var(--sh-inset-crisp)", borderRadius: "6px" }),
                    }}
                    data-testid={`user-card-${u.id}`}
                  >
                    <div
                      role={canMultiSelect ? "checkbox" : undefined}
                      aria-checked={canMultiSelect ? isChecked : undefined}
                      title={canMultiSelect ? "Select" : undefined}
                      onClick={canMultiSelect ? (e) => { e.stopPropagation(); onToggleSelect(u.id); } : undefined}
                      className={cn("relative shrink-0", canMultiSelect && "cursor-pointer")}
                    >
                      <EntityAvatar
                        name={getUserName(u)}
                        photoUrl={u.avatarUrl}
                        bgColor={color.bg}
                        textColor={color.text}
                        size={62}
                      />
                      {canMultiSelect && isChecked && (
                        <div
                          className="absolute inset-0 rounded-full flex items-center justify-center"
                          style={{ background: "color-mix(in srgb, var(--wine) 70%, transparent)" }}
                        >
                          <Check className="h-8 w-8 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate leading-tight">
                        {u.fullName1 || <span className="italic text-muted-foreground font-medium">No name</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{role}</div>
                      {accountName && (
                        <div className="text-[10px] text-muted-foreground/60 truncate mt-1">{accountName}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
