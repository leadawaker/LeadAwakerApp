import { useMemo } from "react";
import type { DemoClientSummary } from "@/features/campaigns/api/demoClientsApi";
import { activityDots, splitRowsByPersona, type ActivityDot, type PersonaRowSplit } from "../../personaDemos";
import type { SeenMap } from "../../personaSeen";
import type { ProspectRow } from "../../prospectRows";

export interface PersonaActivity {
  split: PersonaRowSplit;
  /** Non-null dots only; its keys are the Needs follow-up set. */
  dots: Map<string, ActivityDot>;
  followUp: ReadonlySet<string>;
}

const NO_CLIENTS: DemoClientSummary[] = [];

/**
 * Every prospect row filed under its persona (or No persona / Website visitors), and which cards
 * have unseen recent activity. `clients` may be undefined while the persona list loads. The result
 * keeps its identity until the rows, the personas or the seen map change, so `followUp` is safe to
 * hand to ClientsTab as `onlyNiches`.
 */
export function usePersonaActivity(
  rows: ProspectRow[],
  clients: DemoClientSummary[] | undefined,
  seen: SeenMap,
): PersonaActivity {
  return useMemo(() => {
    const niches = (clients ?? NO_CLIENTS).map((c) => c.niche);
    const split = splitRowsByPersona(rows, niches);
    const dots = activityDots(split, niches, seen, Date.now());
    return { split, dots, followUp: new Set(dots.keys()) };
  }, [rows, clients, seen]);
}
