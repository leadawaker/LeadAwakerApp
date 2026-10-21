// The versions of one upgradeable text: v0 is the saved text, each upgrade adds one and loads it into
// the editor. Mirrored to localStorage per account and field so a reload keeps them; a new saved
// text (the card's Save, or someone else's) starts over and clears the stored list.
import { useEffect, useRef, useState } from "react";
import {
  addVersion, initialVersions, parseStoredVersions, selectVersion, versionsStorageKey, type UpgradeField, type VersionsState,
} from "./upgradeState";

function readStored(key: string, base: string): VersionsState | null {
  try {
    return parseStoredVersions(window.localStorage.getItem(key), base);
  } catch {
    return null;
  }
}

function writeStored(key: string, s: VersionsState): void {
  try {
    if (s.versions.length > 1) window.localStorage.setItem(key, JSON.stringify(s));
    else window.localStorage.removeItem(key);
  } catch {
    // storage blocked or full: the versions just do not survive a reload
  }
}

export function useUpgradeVersions(accountId: number, field: UpgradeField, savedText: string, setText: (t: string) => void) {
  const key = versionsStorageKey(accountId, field);
  const [state, setState] = useState<VersionsState>(() => readStored(key, savedText) ?? initialVersions(savedText));
  const lastSaved = useRef(savedText);
  const setTextRef = useRef(setText);
  setTextRef.current = setText;

  // A restored list puts its active version back in the editor (after useSettingsField set the saved text).
  useEffect(() => {
    if (state.active > 0) setTextRef.current(state.versions[state.active].text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastSaved.current === savedText) return;
    lastSaved.current = savedText;
    setState(initialVersions(savedText));
  }, [savedText]);

  useEffect(() => { writeStored(key, state); }, [key, state]);

  return {
    state,
    add(text: string, changes: string[]) {
      setState((s) => addVersion(s, text, changes));
      setText(text);
    },
    select(i: number) {
      const v = state.versions[i];
      if (!v) return;
      setState((s) => selectVersion(s, i));
      setText(v.text);
    },
  };
}
