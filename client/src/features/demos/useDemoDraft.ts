import { useCallback, useRef, useState } from "react";
import { afterAdd, clearDraft, readDraft, writeDraft, type DemoDraft } from "./createDraft";

const newId = () => crypto.randomUUID();

/**
 * The New demo panel's draft: read once from storage, written on every change.
 * Mount it once in DemosPage so a tab switch never loses input and a reload restores it.
 */
export function useDemoDraft(): {
  draft: DemoDraft;
  update: (patch: Partial<DemoDraft>) => void;
  clear: () => void;
  markAdded: () => void;
} {
  const [draft, setDraft] = useState<DemoDraft>(() => readDraft(newId));
  // The latest draft, so two updates in one tick both land.
  const latest = useRef(draft);

  const commit = useCallback((next: DemoDraft) => {
    latest.current = next;
    writeDraft(next);
    setDraft(next);
  }, []);

  const update = useCallback((patch: Partial<DemoDraft>) => commit({ ...latest.current, ...patch }), [commit]);
  const clear = useCallback(() => commit(clearDraft(newId)), [commit]);
  const markAdded = useCallback(() => commit(afterAdd(latest.current, newId)), [commit]);

  return { draft, update, clear, markAdded };
}
