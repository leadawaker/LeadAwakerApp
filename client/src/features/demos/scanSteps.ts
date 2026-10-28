// The website scan is one request, so its two progress steps are told by the clock:
// the site is read first, then the client is built. Pure, so the timing is tested.

export type ScanStep = "reading" | "building";

/** After this long the scan is shown as building the client rather than reading the site. */
export const SCAN_STEP_SWITCH_MS = 15_000;

export function scanStepAt(elapsedMs: number): ScanStep {
  return elapsedMs >= SCAN_STEP_SWITCH_MS ? "building" : "reading";
}
