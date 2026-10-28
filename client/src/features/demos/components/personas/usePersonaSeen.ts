import { useCallback, useRef, useState } from "react";
import { readPref, writePref } from "@/features/voiceCalls/localPref";
import { USER_ID_KEY } from "@/lib/userIdentity";
import { markSeen as markSeenIn, parseSeen, seenStorageKey, type SeenMap } from "../../personaSeen";

/**
 * Which persona cards this user has opened, and when: a card's activity dot shows only for
 * activity after that time. Kept per user in localStorage (readPref / writePref never throw, so
 * blocked storage just means nothing is remembered). The key is read once, on mount.
 */
export function usePersonaSeen(): { seen: SeenMap; markSeen: (key: string) => void } {
  const [storageKey] = useState(() => seenStorageKey(readPref(USER_ID_KEY)));
  const [seen, setSeen] = useState<SeenMap>(() => parseSeen(readPref(storageKey)));
  // The latest map, so two calls in one tick (close one card, open another) both land.
  const latest = useRef(seen);

  const markSeen = useCallback(
    (key: string) => {
      const next = markSeenIn(latest.current, key, Date.now());
      latest.current = next;
      writePref(storageKey, JSON.stringify(next));
      setSeen(next);
    },
    [storageKey],
  );

  return { seen, markSeen };
}
