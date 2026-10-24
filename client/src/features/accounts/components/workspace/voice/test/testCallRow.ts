// Row figures of the recent test calls list: the cost (Owner only, ElevenLabs is an
// estimate) and the reply delay. Pure; TestCallsList renders them.
import { formatCost } from "@/features/voiceCalls/review/reviewMath";
import { formatDelay } from "./liveMetrics";

export interface TestRowFigures {
  costUsd?: number | null;
  engine?: "gpt-live" | "elevenlabs" | null;
  /** False: the stored cost is an old, wrong price (server costIsCurrent). */
  costCurrent?: boolean | null;
  latencyMs?: number | null;
}

/** The row's cost label: "$0.08", "≈ $0.12" for an ElevenLabs estimate, else the unknown label (also for an old, wrong price). */
export function rowCostLabel(item: TestRowFigures, unknownLabel: string): string {
  const total = item.costUsd;
  if (total == null || item.costCurrent === false) return unknownLabel;
  return formatCost({ total, minutes: 0, ai: 0, recap: 0, telephony: 0, estimate: item.engine === "elevenlabs" }, unknownLabel);
}

/** The reply delay as "≈ 0.8 s", or null when there is none to show. */
export function rowDelayLabel(latencyMs: number | null | undefined): string | null {
  return typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs > 0 ? formatDelay(latencyMs) : null;
}
