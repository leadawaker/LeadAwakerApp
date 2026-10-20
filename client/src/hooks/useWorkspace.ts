import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const KEY = "leadawaker_current_account_id";
/** Set when an agency user explicitly picks an account from the dropdown. Cleared on logout. */
const SELECTED_KEY = "leadawaker_account_explicitly_selected";

/* ─── Shared account store ─────────────────────────────────────────
 * Every useWorkspace() caller used to keep its own useState copy of the
 * account id, so a switch in the picker only updated the picker: the page kept
 * its mount-time id until it remounted (navigation). The id now lives in one
 * module-level store backed by localStorage; all callers subscribe to it.
 */
const listeners = new Set<() => void>();
let cachedId: number | null = null;

function readStoredAccountId(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
    const isAgency = role === "Owner" || role === "Admin";
    // Agency users default to 0 (all-accounts / agency mode) unless they've explicitly picked an account.
    if (isAgency && !localStorage.getItem(SELECTED_KEY)) return 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function getAccountSnapshot(): number {
  if (cachedId === null) cachedId = readStoredAccountId();
  return cachedId;
}

function emitAccountChange() {
  listeners.forEach((l) => l());
}

/** Re-read localStorage (login/logout or GoLink wrote the keys directly) and notify on change. */
export function syncAccountFromStorage() {
  const next = readStoredAccountId();
  if (next === cachedId) return;
  cachedId = next;
  emitAccountChange();
}

/** `explicit` = an agency user's pick; false for the client-role fallback, which must not mark a pick. */
function writeAccountId(id: number, explicit = true) {
  try {
    localStorage.setItem(KEY, String(id));
    if (explicit) {
      if (id === 0) localStorage.removeItem(SELECTED_KEY); // back to agency mode
      else localStorage.setItem(SELECTED_KEY, "1");
    }
  } catch { /* storage blocked: the in-memory value still switches */ }
  if (cachedId === id) return;
  cachedId = id;
  emitAccountChange();
}

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key === KEY || e.key === SELECTED_KEY) syncAccountFromStorage();
}

function subscribeAccount(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export type Account = {
  id: number;
  name: string;
  slug?: string;
  type?: string;
  status?: string;
  owner_email?: string;
  logo_url?: string;
  [key: string]: unknown;
};

export type ImpersonationInfo = {
  role: string;
  accountId?: number;
  sandbox: boolean;
};

export type WorkspaceState = {
  currentAccountId: number;
  setCurrentAccountId: (id: number) => void;
  currentAccount: Account | null;
  isAgencyView: boolean;
  accounts: Account[];
  isLoadingAccounts: boolean;
  /** Current user's role from localStorage */
  userRole: string;
  /** Whether the current user is an Owner (top-tier admin) */
  isOwner: boolean;
  /** Whether the user is Admin (Owner or Admin) */
  isAdmin: boolean;
  /** Whether the user is an agency user (Owner or Admin) */
  isAgencyUser: boolean;
  /** Whether the current user can invite/remove other users */
  canInviteUsers: boolean;
  /** Whether the current user can hard-delete rows (Owner only) */
  canHardDelete: boolean;
  /** Whether the current user can see the expenses page (Owner only) */
  canSeeExpenses: boolean;
  /** Whether the current user can edit system-default AI keys (Owner only) */
  canSeeSystemAiKeys: boolean;
  /** Pages that the current user is allowed to see */
  allowedPages: string[];
  /** Whether to show the Lead Awaker AI bot button in the topbar (Owner/Admin only) */
  showLeadAwakerAi: boolean;
  /** Whether the Owner is currently impersonating a different role */
  isImpersonating: boolean;
  /** Active impersonation details, or null if not impersonating */
  impersonation: ImpersonationInfo | null;
};

/** Pages visible to client users (Manager/Agent/Viewer) — no chat/conversations */
const CLIENT_PAGES = ["contacts", "leads", "campaigns", "calendar", "billing", "accounts"];
/** All pages (for agency users: Owner/Admin) */
const ALL_PAGES = [
  "contacts", "leads", "campaigns", "conversations",
  "calendar", "accounts", "tags", "prompt-library", "users",
  "automation-logs", "traffic", "settings", "billing",
];

export function useWorkspace(): WorkspaceState {
  const realUserRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isRealOwner = realUserRole === "Owner";

  // One shared value for every caller (see the store above): a switch in the
  // account picker re-renders every page that reads the account at once.
  const currentAccountIdState = useSyncExternalStore(subscribeAccount, getAccountSnapshot);

  // Poll /api/auth/me only to detect active impersonation — never overrides localStorage role
  const { data: authMe } = useQuery<{ user: unknown; impersonation: ImpersonationInfo | null } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isRealOwner,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const impersonation = authMe?.impersonation ?? null;

  // While impersonating, the effective role is the impersonated one — this drives
  // page visibility so the UI actually changes when an Owner views as Admin/Client.
  const userRole = impersonation?.role ?? realUserRole;
  const isOwner = !impersonation && realUserRole === "Owner";
  const isAdmin = userRole === "Owner" || userRole === "Admin";
  const isAgencyUser = isAdmin;
  const canInviteUsers = isAdmin;
  const canHardDelete = isOwner;
  const canSeeExpenses = isOwner;
  const canSeeSystemAiKeys = isOwner;
  const showLeadAwakerAi = isAdmin;

  // Fetch accounts from real API (only for agency users)
  const { data: apiAccounts, isLoading: isLoadingAccounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAgencyUser,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch own account for non-agency users (name resolution)
  const { data: ownAccount } = useQuery<Account>({
    queryKey: [`/api/accounts/${currentAccountIdState}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !isAgencyUser && currentAccountIdState > 0,
    staleTime: 10 * 60 * 1000,
  });

  const accountsList: Account[] = useMemo(() => {
    if (apiAccounts && Array.isArray(apiAccounts)) {
      return apiAccounts;
    }
    return [];
  }, [apiAccounts]);

  // A stored selection can outlive its account (deleted since, or picked in an
  // older session). Drop it back to agency mode: otherwise pages that filter by
  // this id come up empty while the switcher shows some other account.
  useEffect(() => {
    if (!isAgencyUser || currentAccountIdState === 0 || accountsList.length === 0) return;
    if (accountsList.some((a) => a.id === currentAccountIdState)) return;
    writeAccountId(0);
  }, [isAgencyUser, currentAccountIdState, accountsList]);

  const setCurrentAccountId = (id: number) => {
    if (isAgencyUser) writeAccountId(id);
  };

  // Force non-agency users away from 0 (all accounts)
  useEffect(() => {
    if (!isAgencyUser && currentAccountIdState === 0) {
      const fallback = Number(localStorage.getItem(KEY)) || 1;
      writeAccountId(fallback > 0 ? fallback : 1, false);
    }
  }, [isAgencyUser, currentAccountIdState]);

  const currentAccount = useMemo(() => {
    // 0 = "All Accounts" / Agency mode — no specific account selected
    if (currentAccountIdState === 0) return null;
    if (accountsList.length > 0) {
      return accountsList.find((a) => a.id === currentAccountIdState) ?? null;
    }
    // Fallback for non-agency users who don't fetch accounts
    return ownAccount ?? {
      id: currentAccountIdState,
      name: localStorage.getItem("leadawaker_account_name") || "My Account",
    };
  }, [currentAccountIdState, accountsList, ownAccount]);

  // Agency view (all-accounts mode) is now derived from the effective role, not
  // the URL. The CRM lives under a single /platform prefix; an Owner/Admin sees
  // the agency view, while a client role (or an Owner impersonating one) sees the
  // scoped single-account view.
  const isAgencyView = isAgencyUser;

  const allowedPages = isAgencyUser ? ALL_PAGES : CLIENT_PAGES;

  return {
    currentAccountId: currentAccountIdState,
    setCurrentAccountId,
    currentAccount,
    isAgencyView,
    accounts: accountsList,
    isLoadingAccounts,
    userRole,
    isOwner,
    isAdmin,
    isAgencyUser,
    canInviteUsers,
    canHardDelete,
    canSeeExpenses,
    canSeeSystemAiKeys,
    allowedPages,
    showLeadAwakerAi,
    isImpersonating: !!impersonation,
    impersonation,
  };
}
