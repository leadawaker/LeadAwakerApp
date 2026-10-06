import type { TFunction } from "i18next";
import type { VoiceCallListItem, VoiceOutcome } from "./api/voiceCallsApi";
import { isToday } from "./format";
import { callStatus, normalizeOutcome, VOICE_CALL_STATUSES, type VoiceCallStatus } from "./status";

export type VoiceCallSort = "recent" | "oldest" | "longest" | "shortest" | "name";
export type VoiceCallGroup = "date" | "status" | "language" | "none";

export const SORTS: VoiceCallSort[] = ["recent", "oldest", "longest", "shortest", "name"];
export const GROUPS: VoiceCallGroup[] = ["date", "status", "language", "none"];

export interface ListOptions {
  query: string;
  /** Empty means every outcome. */
  outcomes: VoiceOutcome[];
  statuses: VoiceCallStatus[];
  languages: string[];
  sort: VoiceCallSort;
  group: VoiceCallGroup;
}

export function filterCalls(calls: VoiceCallListItem[], opts: Pick<ListOptions, "query" | "outcomes" | "statuses" | "languages">): VoiceCallListItem[] {
  let list = calls;
  if (opts.outcomes.length) list = list.filter((c) => opts.outcomes.includes(normalizeOutcome(c.outcome)));
  if (opts.statuses.length) list = list.filter((c) => opts.statuses.includes(callStatus(c)));
  if (opts.languages.length) list = list.filter((c) => opts.languages.includes(c.language ?? ""));
  const q = opts.query.trim().toLowerCase();
  if (q) {
    const qDigits = q.replace(/\D/g, "");
    list = list.filter((c) =>
      (c.callerName ?? "").toLowerCase().includes(q) ||
      (c.conclusion ?? "").toLowerCase().includes(q) ||
      (c.personaCompany ?? "").toLowerCase().includes(q) ||
      (c.personaNiche ?? "").toLowerCase().includes(q) ||
      (c.accountName ?? "").toLowerCase().includes(q) ||
      (!!qDigits && (c.callerNumber ?? "").replace(/\D/g, "").includes(qDigits)));
  }
  return list;
}

/** Demo rows are titled by persona, Live rows by caller. */
function sortName(c: VoiceCallListItem): string {
  return (c.scope === "demo" ? c.personaCompany : null) ?? c.callerName ?? c.callerNumber ?? "~";
}

export function sortCalls(calls: VoiceCallListItem[], sort: VoiceCallSort): VoiceCallListItem[] {
  const time = (c: VoiceCallListItem) => new Date(c.startedAt).getTime();
  const len = (c: VoiceCallListItem) => c.durationSeconds ?? 0;
  const out = [...calls];
  switch (sort) {
    case "oldest": return out.sort((a, b) => time(a) - time(b));
    case "longest": return out.sort((a, b) => len(b) - len(a));
    case "shortest": return out.sort((a, b) => len(a) - len(b));
    case "name": return out.sort((a, b) => sortName(a).localeCompare(sortName(b)));
    default: return out.sort((a, b) => time(b) - time(a));
  }
}

export interface CallGroup { key: string; label: string; items: VoiceCallListItem[] }

export function groupCalls(calls: VoiceCallListItem[], group: VoiceCallGroup, t: TFunction): CallGroup[] {
  if (group === "none") return [{ key: "all", label: "", items: calls }];
  if (group === "date") {
    return [
      { key: "today", label: t("groups.today"), items: calls.filter((c) => isToday(c.startedAt)) },
      { key: "earlier", label: t("groups.earlier"), items: calls.filter((c) => !isToday(c.startedAt)) },
    ].filter((g) => g.items.length > 0);
  }
  if (group === "status") {
    return VOICE_CALL_STATUSES
      .map((s) => ({ key: s, label: t(`status.${s}`), items: calls.filter((c) => callStatus(c) === s) }))
      .filter((g) => g.items.length > 0);
  }
  const langs = Array.from(new Set(calls.map((c) => c.language ?? "")));
  return langs.map((l) => ({ key: l || "none", label: l ? l.toUpperCase() : t("unknownLanguage"), items: calls.filter((c) => (c.language ?? "") === l) }));
}
