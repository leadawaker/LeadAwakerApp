// Turns a server-ordered page of leads (GET /api/leads/page) into list rows:
// a group header wherever `group_key` changes, with the group's count from the
// server (all matching leads, not just the loaded ones).
import type { VirtualListItem } from "../components/cardView/types";
import { stageLabel } from "./leadDisplay";

type T = (key: string, opts?: Record<string, any>) => string;

export function groupLabel(groupBy: string, key: string, t: T): string {
  switch (groupBy) {
    case "date": return t(`time.${key}`);
    case "status": return stageLabel(t, key || "Unknown");
    case "type": return t(`conversationType.${key || "other"}`);
    case "campaign": return key || t("group.noCampaign");
    case "account": return key || t("group.noAccount");
    case "service": return key || t("group.noService");
    case "source": return key || t("group.noSource");
    case "tag": return key || t("group.untagged");
    default: return key;
  }
}

export function buildServerRows(
  leads: Record<string, any>[],
  groupBy: string,
  groups: { key: string; count: number }[],
  leadTagsInfo: Map<number, { name: string; color: string }[]>,
  t: T,
): VirtualListItem[] {
  const counts = new Map(groups.map((g) => [g.key, g.count]));
  const out: VirtualListItem[] = [];
  let current: string | null = null;
  for (const lead of leads) {
    if (groupBy && groupBy !== "none") {
      const key = String(lead.group_key ?? "");
      if (key !== current) {
        current = key;
        out.push({ kind: "header", label: groupLabel(groupBy, key, t), count: counts.get(key) ?? 0 });
      }
    }
    out.push({ kind: "lead", lead, tags: leadTagsInfo.get(Number(lead.Id ?? lead.id)) || [] });
  }
  return out;
}
