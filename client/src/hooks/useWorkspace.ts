import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

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

export type WorkspaceState = {
  currentAccountId: number;
  setCurrentAccountId: (id: number) => void;
  currentAccount: Account | null;
  isAgencyView: boolean;
  accounts: Account[];
  isLoadingAccounts: boolean;
  /** Current user's role from localStorage */
  userRole: string;
  /** Whether the current user is an Admin */
  isAdmin: boolean;
  /** Whether the current user is an agency user (Admin or Operator) */
  isAgencyUser: boolean;
  /** Pages that the current user is allowed to see */
  allowedPages: string[];
};

/** Pages visible to client users (Manager/Viewer) */
const CLIENT_PAGES = ["contacts", "leads", "campaigns", "conversations", "calendar"];
/** All pages (for agency users: Admin/Operator) */
const ALL_PAGES = [
  "contacts", "leads", "campaigns", "conversations",
  "calendar", "accounts", "tags", "prompt-library", "users",
  "automation-logs", "settings",
];

export function useWorkspace(): WorkspaceState {
  const [location] = useLocation();
  const userRole = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAdmin = userRole === "Admin";
  const isAgencyUser = userRole === "Admin" || userRole === "Operator";

  const [currentAccountId, setCurrentAccountIdState] = useState<number>(() => {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
    const isAgency = role === "Admin" || role === "Operator";
    // Agency users default to 0 (all-accounts view) unless they've explicitly picked an account.
    // This prevents stale localStorage values (e.g. set by old code) from defaulting to a subaccount.
    if (isAgency && !localStorage.getItem(SELECTED_KEY)) return 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

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
      if (currentAccountId !== accountId) {
        setCurrentAccountIdState(accountId);
      }
    }
    localStorage.setItem(KEY, String(currentAccountId));
  }, [currentAccountId, isAgencyUser]);

  const setCurrentAccountId = (id: number) => {
    if (isAgencyUser) {
      setCurrentAccountIdState(id);
      localStorage.setItem(KEY, String(id));
      localStorage.setItem(SELECTED_KEY, "1");
    }
  };

  // Force non-agency users away from 0 (all accounts)
  useEffect(() => {
    if (!isAgencyUser && currentAccountId === 0) {
      const fallback = Number(localStorage.getItem(KEY)) || 1;
      setCurrentAccountIdState(fallback > 0 ? fallback : 1);
    }
  }, [isAgencyUser, currentAccountId]);

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
  }, [currentAccountId, accountsList]);

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
    isAdmin,
    isAgencyUser,
    allowedPages,
  };
}
