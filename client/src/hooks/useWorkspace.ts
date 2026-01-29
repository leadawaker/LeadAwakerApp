import { useEffect, useMemo, useState } from "react";
import { accounts, type Account } from "@/data/mocks";

const KEY = "leadawaker_current_account_id";

export type WorkspaceState = {
  currentAccountId: number;
  setCurrentAccountId: (id: number) => void;
  currentAccount: Account;
  isAgencyView: boolean;
};

export function useWorkspace(): WorkspaceState {
  const [currentAccountId, setCurrentAccountIdState] = useState<number>(() => {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  useEffect(() => {
    localStorage.setItem(KEY, String(currentAccountId));
  }, [currentAccountId]);

  const setCurrentAccountId = (id: number) => setCurrentAccountIdState(id);

  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.id === currentAccountId) ?? accounts[0];
  }, [currentAccountId]);

  const isAgencyView = currentAccountId === 1;

  return { currentAccountId, setCurrentAccountId, currentAccount, isAgencyView };
}
