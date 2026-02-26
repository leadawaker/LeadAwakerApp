import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const KEY = "leadawaker_current_account_id";

export type Account = {
  id: number;
  name: string;
  slug?: string;
  type?: string;
  status?: string;
  owner_email?: string;
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
const CLIENT_PAGES = ["dashboard", "contacts", "leads", "campaigns", "conversations", "calendar", "users"];
/** All pages (for agency users: Admin/Operator) */
const ALL_PAGES = [
  "dashboard", "contacts", "leads", "campaigns", "conversations",
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
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  // Fetch accounts from real API (only for agency users)
  const { data: apiAccounts, isLoading: isLoadingAccounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAgencyUser,
    staleTime: 5 * 60 * 1000,
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
    }
  };

  const currentAccount = useMemo(() => {
    if (accountsList.length > 0) {
      return accountsList.find((a) => a.id === currentAccountId) ?? accountsList[0];
    }
    // Fallback for non-agency users who don't fetch accounts
    return {
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
