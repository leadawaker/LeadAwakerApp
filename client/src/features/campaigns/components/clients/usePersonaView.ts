import { useCallback, useState } from "react";
import { readPref, writePref } from "@/features/voiceCalls/localPref";
import { DEFAULT_PERSONA_FILTERS, type PersonaFilters } from "./personaFilters";
import { parseGroupBy, type GroupBy } from "./personaView";

// v2: Date became the default (2026-10). The old key held Category for nearly everyone
// (the old default), so it is left behind and each user starts on Date once.
const GROUP_BY_KEY = "demos.personas.groupBy.v2";

/**
 * What the persona list remembers about how it is shown: the filters and the
 * grouping. The Demos page calls this once and hands it to the topbar and the
 * list, which are siblings; the Campaigns page's Clients tab has no topbar slot
 * for them, so ClientsTab calls it itself there. The grouping survives a reload
 * (localStorage, never throwing); the filters start clear each visit.
 */
export function usePersonaView() {
  const [filters, setFilters] = useState<PersonaFilters>(DEFAULT_PERSONA_FILTERS);
  const [groupBy, setGroupByState] = useState<GroupBy>(() => parseGroupBy(readPref(GROUP_BY_KEY)));
  const setGroupBy = useCallback((next: GroupBy) => {
    setGroupByState(next);
    writePref(GROUP_BY_KEY, next);
  }, []);
  return { filters, setFilters, groupBy, setGroupBy };
}

export type PersonaView = ReturnType<typeof usePersonaView>;
