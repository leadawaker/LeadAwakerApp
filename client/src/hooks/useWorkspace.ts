import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { API_BASE } from "@/lib/apiUtils";

const KEY = "leadawaker_current_account_id";
/** Set when an agency user explicitly picks an account from the dropdown. Cleared on logout. */
const SELECTED_KEY = "leadawaker_account_explicitly_selected";

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
  role: "Admin" | "Manager" | "Viewer";
  accountId?: number;
  sandbox: boolean;
} | null;

export type WorkspaceState = {
  currentAccountId: number;
  setCurrentAccountId: (id: number) => void;
  currentAccount: Account | null;
  isAgencyView: boolean;
  accounts: Account[];
  isLoadingAccounts: boolean;
  /** Current user's real role from localStorage */
  userRole: string;
  /** Effective role: impersonated role if active, otherwise real role */
  effectiveRole: string;
  /** Whether the current user is an Owner (top-tier admin) */
  isOwner: boolean;
  /** Whether the effective role is Admin (includes Owner + Operator alias). Falls to false during client impersonation. */
  isAdmin: boolean;
  /** Whether the effective role is an agency user (Owner, Admin, or Operator) */
  isAgencyUser: boolean;
  /** Whether the current user can invite/remove other users */
  canInviteUsers: boolean;
  /** Whether the current user can hard-delete rows (Owner only) */
  canHardDelete: boolean;
  /** Whether the current user can see the expenses page (Owner only). Page wiring is TODO. */
  canSeeExpenses: boolean;
  /** Whether the current user can edit system-default AI keys (Owner only). UI wiring is TODO. */
  canSeeSystemAiKeys: boolean;
  /** Pages that the current user is allowed to see */
  allowedPages: string[];
  /** Whether to show the Lead Awaker AI bot button in the topbar. Hidden during client impersonation. */
  showLeadAwakerAi: boolean;
  /** Whether Owner is currently impersonating another role */
  isImpersonating: boolean;
  /** The active impersonation details, or null */
  impersonation: ImpersonationInfo;
};

/** Pages visible to client users (Manager/Agent/Viewer) — billing is admin+ only */
const CLIENT_PAGES = ["contacts", "leads", "campaigns", "conversations", "calendar"];
/** All pages (for agency users: Owner/Admin/Operator) */
const ALL_PAGES = [
  "contacts", "leads", "campaigns", "conversations",
  "calendar", "accounts", "tags", "prompt-library", "users",
  "automation-logs", "settings", "billing",
];

export function useWorkspace(): WorkspaceState {
  const [location] = useLocation();
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isRealOwner = userRole === "Owner";

  // Fetch /api/auth/me to get impersonation state (cached, stale after 30s)
  const { data: meData } = useQuery<{ impersonation: ImpersonationInfo }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return { impersonation: null };
      return res.json();
    },
    // Only fetch if the real user is an Owner (only Owners can impersonate)
    enabled: isRealOwner,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const impersonation: ImpersonationInfo = (isRealOwner ? meData?.impersonation : null) ?? null;
  const isImpersonating = Boolean(impersonation);

  // The effective role drives all UI permission checks
  const effectiveRole = impersonation ? impersonation.role : userRole;

  const isOwner = isRealOwner && !isImpersonating;
  // isAdmin true for Owner, Admin, Operator — but false when impersonating a client role
  const isAdmin = effectiveRole === "Owner" || effectiveRole === "Admin" || effectiveRole === "Operator";
  const isAgencyUser = isAdmin;
  const canInviteUsers = isAdmin;
  const canHardDelete = isOwner;
  const canSeeExpenses = isOwner;
  const canSeeSystemAiKeys = isOwner;
  // Hidden when impersonating a client (non-agency) role
  const showLeadAwakerAi = isAdmin;

  const [currentAccountIdState, setCurrentAccountIdState] = useState<number>(() => {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
    const isAgency = role === "Owner" || role === "Admin" || role === "Operator";
    // Agency users default to 0 (all-accounts view) unless they've explicitly picked an account.
    if (isAgency && !localStorage.getItem(SELECTED_KEY)) return 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

  // During client impersonation, override the account to the impersonated one
  const currentAccountId = (impersonation?.accountId && !isAdmin)
    ? impersonation.accountId
    : currentAccountIdState;

  // Fetch accounts from real API (only for agency users)
  const { data: apiAccounts, isLoading: isLoadingAccounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAgencyUser,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch own account for non-agency users (name resolution)
  const { data: ownAccount } = useQuery<Account>({
    queryKey: [`/api/accounts/${currentAccountId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !isAgencyUser && currentAccountId > 0,
    staleTime: 10 * 60 * 1000,
  });

  const accountsList: Account[] = useMemo(() => {
    if (apiAccounts && Array.isArray(apiAccounts)) {
      return apiAccounts;
    }
    return [];
  }, [apiAccounts]);

  // For non-agency users, force their account
  useEffect(() => {
    if (!isAgencyUser) {
      const accountId = Number(localStorage.getItem(KEY)) || 1;
      if (currentAccountIdState !== accountId) {
        setCurrentAccountIdState(accountId);
      }
    }
    localStorage.setItem(KEY, String(currentAccountIdState));
  }, [currentAccountIdState, isAgencyUser]);

  const setCurrentAccountId = (id: number) => {
    if (isAgencyUser) {
      setCurrentAccountIdState(id);
      localStorage.setItem(KEY, String(id));
      localStorage.setItem(SELECTED_KEY, "1");
    }
  };

  // Force non-agency users away from 0 (all accounts)
  useEffect(() => {
    if (!isAgencyUser && currentAccountIdState === 0) {
      const fallback = Number(localStorage.getItem(KEY)) || 1;
      setCurrentAccountIdState(fallback > 0 ? fallback : 1);
    }
  }, [isAgencyUser, currentAccountIdState]);

  const currentAccount = useMemo(() => {
    // 0 = "All Accounts" — no specific account selected
    if (currentAccountId === 0) return null;
    if (accountsList.length > 0) {
      return accountsList.find((a) => a.id === currentAccountId) ?? accountsList[0];
    }
    // Fallback for non-agency users who don't fetch accounts
    return ownAccount ?? {
      id: currentAccountId,
      name: localStorage.getItem("leadawaker_account_name") || "My Account",
    };
  }, [currentAccountId, accountsList, ownAccount]);

  // Agency view: reactive URL-based detection via wouter useLocation
  const isAgencyView = useMemo(() => {
    return location.startsWith("/agency");
  }, [location]);

  const allowedPages = isAgencyUser ? ALL_PAGES : CLIENT_PAGES;

  return {
    currentAccountId,
    setCurrentAccountId,
    currentAccount,
    isAgencyView,
    accounts: accountsList,
    isLoadingAccounts,
    userRole,
    effectiveRole,
    isOwner,
    isAdmin,
    isAgencyUser,
    canInviteUsers,
    canHardDelete,
    canSeeExpenses,
    canSeeSystemAiKeys,
    allowedPages,
    showLeadAwakerAi,
    isImpersonating,
    impersonation,
  };
}
