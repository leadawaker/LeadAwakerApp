import { useMemo } from "react";
import { buildEntityRows } from "@/components/crm/entityList";
import {
  ProspectRow,
  VirtualListItem,
  ProspectGroupBy,
  buildNicheColorMap,
  FALLBACK_NICHE_COLOR,
  STATUS_GROUP_ORDER,
  DATE_BUCKET_ORDER,
  getDateBucket,
} from "./prospectTypes";

interface FilteringOptions {
  // Server has already filtered, sorted, and order-by-group'd the array.
  // This hook only interleaves group headers and exposes color / filter-option helpers.
  prospects: ProspectRow[];
  groupBy: ProspectGroupBy;
  groupDirection: "asc" | "desc";
  availableNiches?: string[];
  availableCountries?: string[];
  availableSources?: string[];
}

export function useProspectListFiltering({
  prospects,
  groupBy,
  groupDirection,
  availableNiches: providedNiches,
  availableCountries: providedCountries,
  availableSources: providedSources,
}: FilteringOptions) {
  const flatItems = useMemo((): VirtualListItem[] => {
    if (groupBy === "none") {
      return prospects.map((p) => ({ kind: "prospect" as const, prospect: p }));
    }

    // Server sorted by group column, so consecutive items with the same key belong together.
    const bucketKey = (p: ProspectRow): string => {
      switch (groupBy) {
        case "status":       return String(p.status || "New");
        case "niche":        return String(p.niche || "Other");
        case "country":      return String(p.country || "Unknown");
        case "priority":     return String(p.priority || "Medium");
        case "date_created": return getDateBucket(p.created_at);
        case "date_updated": return getDateBucket(p.updated_at || p.created_at);
        default:             return String(p.status || "New");
      }
    };

    // Group ordering depends on the active field; fixed sequences for
    // status/priority/date, alphabetical for niche/country. Direction reverse
    // is applied by buildEntityRows after this ordering.
    const orderGroups = (keys: string[]): string[] => {
      if (groupBy === "status") {
        return STATUS_GROUP_ORDER.filter((k) => keys.includes(k))
          .concat(keys.filter((k) => !STATUS_GROUP_ORDER.includes(k)));
      }
      if (groupBy === "priority") {
        return ["High", "Medium", "Low"].filter((k) => keys.includes(k))
          .concat(keys.filter((k) => !["High", "Medium", "Low"].includes(k)));
      }
      if (groupBy === "date_created" || groupBy === "date_updated") {
        return DATE_BUCKET_ORDER.filter((k) => keys.includes(k));
      }
      return [...keys].sort();
    };

    return buildEntityRows<ProspectRow, VirtualListItem>({
      items: prospects,
      groupKeyOf: bucketKey,
      groupDirection,
      orderGroups,
      makeHeader: (label, count) => ({ kind: "header", label, count }),
      makeItem: (prospect) => ({ kind: "prospect", prospect }),
    });
  }, [prospects, groupBy, groupDirection]);

  // Niche color map — derived from loaded items + provided filter options (so colors stay stable as more load)
  const nicheColorMap = useMemo(() => {
    const niches = new Set<string>();
    prospects.forEach((p) => { const v = String(p.niche || ""); if (v) niches.add(v); });
    (providedNiches ?? []).forEach((n) => { if (n) niches.add(n); });
    return buildNicheColorMap(Array.from(niches));
  }, [prospects, providedNiches]);

  const getNicheColor = (niche: string) => nicheColorMap.get(niche.toLowerCase()) ?? FALLBACK_NICHE_COLOR;

  // Fallback when filter-options endpoint hasn't returned yet: derive from loaded slice
  const availableNiches = useMemo(() => {
    if (providedNiches && providedNiches.length > 0) return providedNiches;
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.niche || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects, providedNiches]);

  const availableCountries = useMemo(() => {
    if (providedCountries && providedCountries.length > 0) return providedCountries;
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.country || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects, providedCountries]);

  const availableSources = useMemo(() => {
    if (providedSources && providedSources.length > 0) return providedSources;
    const seen = new Set<string>();
    prospects.forEach((p) => { const v = String(p.source || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [prospects, providedSources]);

  return {
    flatItems,
    getNicheColor,
    availableNiches,
    availableCountries,
    availableSources,
  };
}
