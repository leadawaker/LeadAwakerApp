// The script panel's versions (lib/scriptVersions.ts) in React state, mirrored to localStorage on every
// change. The panel is keyed by script id, so one hook instance is one script. Unsaved versions from an
// earlier visit are not loaded silently: they are offered back ("restorable") so the editor never jumps.
import { useEffect, useRef, useState } from "react";
import {
  clearVersions, hasUnsaved, initialVersions, loadVersions, saveVersions, versionsKey, withImproved, withSelected, type VersionState,
} from "./scriptVersions";

export function useScriptVersions(accountId: number, scriptId: number, savedBody: string) {
  const key = versionsKey(accountId, scriptId);
  const [state, setState] = useState<VersionState>(() => initialVersions(savedBody));
  const [restorable, setRestorable] = useState<VersionState | null>(() => loadVersions(key));
  const ref = useRef({ state, restorable });

  const commit = (next: VersionState, nextRestorable: VersionState | null = null) => {
    ref.current = { state: next, restorable: nextRestorable };
    setState(next);
    setRestorable(nextRestorable);
    saveVersions(key, next);
  };

  // The saved text changed on the server with no AI work open: that is the new Original.
  useEffect(() => {
    const cur = ref.current;
    if (!hasUnsaved(cur.state) && cur.state.versions[0].body !== savedBody) {
      const next = initialVersions(savedBody);
      ref.current = { ...cur, state: next };
      setState(next);
    }
  }, [savedBody]);

  return {
    state,
    shown: state.versions[state.index],
    restorable,
    /** An AI answer. Still runs (to localStorage) when it lands after the panel closed. */
    improved(sentBody: string, result: { title: string; body: string }, notes: string) {
      const { state: cur, restorable: earlier } = ref.current;
      // Earlier versions not restored yet are kept in front, never overwritten.
      const base = earlier && !hasUnsaved(cur) ? earlier : cur;
      commit(withImproved(base, sentBody, result, notes));
    },
    select(currentBody: string, index: number) {
      commit(withSelected(ref.current.state, currentBody, index), ref.current.restorable);
    },
    restore() {
      if (ref.current.restorable) commit(ref.current.restorable);
    },
    discard() {
      clearVersions(key);
      ref.current = { ...ref.current, restorable: null };
      setRestorable(null);
    },
    /** After Save: what was saved is the new Original, the stored versions go. */
    reset(body: string) {
      clearVersions(key);
      const next = initialVersions(body);
      ref.current = { state: next, restorable: null };
      setState(next);
      setRestorable(null);
    },
  };
}
