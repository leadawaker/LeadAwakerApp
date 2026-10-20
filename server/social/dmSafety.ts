// Comment-to-DM safety switches. A real send needs BOTH the account's dm_mode = "live" AND the
// server-wide kill switch INSTAGRAM_DM_LIVE=1. Anything else is off or dry-run: nothing leaves.
import type { DmMode } from "@shared/socialStudio";

export function dmLiveSwitchOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INSTAGRAM_DM_LIVE === "1";
}

/** What actually happens for an account: "live" only when both switches say so. */
export function effectiveDmMode(accountMode: DmMode | string | null | undefined, env: NodeJS.ProcessEnv = process.env): DmMode {
  if (accountMode === "live") return dmLiveSwitchOn(env) ? "live" : "dry_run";
  if (accountMode === "dry_run") return "dry_run";
  return "off";
}
