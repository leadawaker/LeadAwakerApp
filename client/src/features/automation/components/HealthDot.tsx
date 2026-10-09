import type { CSSProperties } from "react";
import type { HealthState } from "@shared/automationTypes";
import { BUCKET_COLOR, bucketOf } from "../status";

/** Status dot: green fine, amber needs a look, red broken, grey ring while waiting. Problems breathe. */
export function HealthDot({ state, title }: { state: HealthState; title?: string }) {
  const bucket = bucketOf(state);
  const cls = ["am-dot", bucket === "waiting" && "am-dot--hollow", (bucket === "broken" || bucket === "attention") && "am-dot--alert"]
    .filter(Boolean)
    .join(" ");
  return <span role="img" aria-label={title ?? state} title={title ?? state} className={cls} style={{ "--am-dot": BUCKET_COLOR[bucket] } as CSSProperties} />;
}
