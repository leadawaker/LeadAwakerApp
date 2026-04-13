import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

/**
 * Entity data visible on the current page, published by page components
 * and consumed by the AI agent widget for context injection.
 */
export interface PageEntityData {
  /** Type of entity being viewed */
  entityType: "lead" | "campaign" | "conversation" | "account" | "task" | "prompt" | "list" | "prospect" | "none";
  /** Entity ID (for detail views) */
  entityId?: number | string;
  /** Human-readable entity name */
  entityName?: string;
  /** Summary of entity data (key fields) */
  summary?: Record<string, unknown>;
  /** Active filters on list pages */
  filters?: Record<string, unknown>;
  /** Timestamp when this entity data was set */
  updatedAt: number;
}

interface PageEntityContextValue {
  /** Current entity data visible on screen */
  entityData: PageEntityData | null;
  /** Set entity data (called by page components) */
  setEntityData: (data: PageEntityData) => void;
  /** Clear entity data (called on navigation away) */
  clearEntityData: () => void;
}

const PageEntityContext = createContext<PageEntityContextValue | null>(null);

export function PageEntityProvider({ children }: { children: ReactNode }) {
  const [entityData, setEntityDataState] = useState<PageEntityData | null>(null);

  const setEntityData = useCallback((data: PageEntityData) => {
    setEntityDataState({ ...data, updatedAt: Date.now() });
  }, []);

  const clearEntityData = useCallback(() => {
    setEntityDataState(null);
  }, []);

  return (
    <PageEntityContext.Provider value={{ entityData, setEntityData, clearEntityData }}>
      {children}
    </PageEntityContext.Provider>
  );
}

export function usePageEntity(): PageEntityContextValue {
  const ctx = useContext(PageEntityContext);
  if (!ctx) throw new Error("usePageEntity must be used within PageEntityProvider");
  return ctx;
}

/**
 * Hook for page components to publish their entity data to the AI agent widget.
 * Automatically clears on unmount.
 */
export function usePublishEntityData() {
  const { setEntityData, clearEntityData } = usePageEntity();
  const clearRef = useRef(clearEntityData);
  clearRef.current = clearEntityData;

  // Clear entity data on unmount (when navigating away)
  useEffect(() => {
    return () => {
      clearRef.current();
    };
  }, []);

  return setEntityData;
}
