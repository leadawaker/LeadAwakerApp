import { useTranslation } from "react-i18next";
import { ChevronDown, Check, Repeat } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * MobileAgencySwitcher — the account/agency switcher used in the top row of the
 * mobile list header. Ports the `la-switcher` pill from the design prototype
 * (mobile-shell.jsx MobListBar) and reuses the account-switch logic from the
 * desktop Topbar.
 *
 * Admins get a dropdown (All Accounts + each account); non-admins see a static
 * label of their current account.
 */
export function MobileAgencySwitcher() {
  const { t } = useTranslation("crm");
  const { isAdmin, accounts, currentAccountId, currentAccount, setCurrentAccountId } = useWorkspace();

  const label = currentAccountId === 0
    ? t("topbar.agencyView")
    : (currentAccount?.name || t("topbar.agencyView"));

  if (!isAdmin) {
    return (
      <span
        className="la-switcher"
        style={{ width: "auto", padding: "7px 12px", gap: 8, cursor: "default" }}
        data-testid="mobile-agency-label"
      >
        <span className="row" style={{ gap: 8 }}>
          <Repeat size={13} />
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="la-switcher"
          style={{ width: "auto", padding: "7px 12px", gap: 8 }}
          data-testid="mobile-agency-switcher"
        >
          <span className="row" style={{ gap: 8 }}>
            <Repeat size={13} />
            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          </span>
          <span style={{ display: "flex", color: "var(--mute-2)" }}><ChevronDown size={13} /></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-2xl shadow-xl border-border bg-background mt-1">
        <DropdownMenuItem
          onClick={() => setCurrentAccountId(0)}
          className={cn("flex items-center gap-2 cursor-pointer py-2 rounded-xl mx-1", currentAccountId === 0 && "font-semibold")}
        >
          <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--wine-tint)" }}>
            <img src="/premium/favicon.svg" alt="" className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm truncate flex-1">{t("topbar.allAccounts")}</span>
          {currentAccountId === 0 && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-2" />
        {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map((acc) => (
          <DropdownMenuItem
            key={acc.id}
            onClick={() => setCurrentAccountId(acc.id)}
            className={cn("flex items-center gap-2 cursor-pointer py-2 rounded-xl mx-1", currentAccountId === acc.id && "font-semibold")}
          >
            {acc.logo_url ? (
              <img src={acc.logo_url} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 text-white" style={{ background: "var(--wine)" }}>
                {acc.name?.[0] || "?"}
              </div>
            )}
            <span className="text-sm truncate flex-1">{acc.name}</span>
            {currentAccountId === acc.id && <Check className="h-3 w-3 text-muted-foreground shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
