import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface TopbarActionsContextValue {
  topbarActions: ReactNode;
  setTopbarActions: (node: ReactNode) => void;
  clearTopbarActions: () => void;
}

const TopbarActionsContext = createContext<TopbarActionsContextValue>({
  topbarActions: null,
  setTopbarActions: () => {},
  clearTopbarActions: () => {},
});

export function TopbarActionsProvider({ children }: { children: ReactNode }) {
  const [topbarActions, setTopbarActionsState] = useState<ReactNode>(null);
  const setTopbarActions = useCallback((node: ReactNode) => setTopbarActionsState(node), []);
  const clearTopbarActions = useCallback(() => setTopbarActionsState(null), []);
  return (
    <TopbarActionsContext.Provider value={{ topbarActions, setTopbarActions, clearTopbarActions }}>
      {children}
    </TopbarActionsContext.Provider>
  );
}

export function useTopbarActions() {
  return useContext(TopbarActionsContext);
}
