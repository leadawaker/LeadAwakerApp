import { useEffect, useMemo, useState } from "react";
import { accounts, users, type Account } from "@/data/mocks";

const KEY = "leadawaker_current_account_id";

export type WorkspaceState = {
  currentAccountId: number;
  setCurrentAccountId: (id: number) => void;
  currentAccount: Account;
  isAgencyView: boolean;
};

export function useWorkspace(): WorkspaceState {
  const [currentAccountId, setCurrentAccountIdState] = useState<number>(() => {
    // Force specific account if not admin
    const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
    if (currentUserEmail !== "leadawaker@gmail.com") {
      const user = users.find(u => u.email === currentUserEmail);
      if (user) return user.account_id;
    }
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  useEffect(() => {
    const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
    if (currentUserEmail !== "leadawaker@gmail.com") {
      const user = users.find(u => u.email === currentUserEmail);
      if (user && currentAccountId !== user.account_id) {
        setCurrentAccountIdState(user.account_id);
      }
    }
    localStorage.setItem(KEY, String(currentAccountId));
  }, [currentAccountId]);

  const setCurrentAccountId = (id: number) => {
    const currentUserEmail = localStorage.getItem("leadawaker_user_email") || "leadawaker@gmail.com";
    if (currentUserEmail === "leadawaker@gmail.com") {
      setCurrentAccountIdState(id);
    }
  };

  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === currentAccountId) ?? accounts[0];
  }, [currentAccountId]);

  const isAgencyView = currentAccountId === 1;

  return { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView };
}
