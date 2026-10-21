// Pure rules behind "Upgrade with AI": the versions list (v0 is the saved text, each upgrade adds one),
// how it is kept in localStorage per account and field, and which error message a reason shows.
import { studioErrorKey } from "../../../lib/studio";

export type UpgradeField = "caption_style" | "voice_guide";

export interface UpgradeVersion { text: string; changes: string[] }
export interface VersionsState {
  /** The saved text the versions start from. A different saved text makes stored versions stale. */
  base: string;
  versions: UpgradeVersion[];
  active: number;
}

export const MAX_VERSIONS = 20;

export const versionsStorageKey = (accountId: number, field: UpgradeField) => `la.social.upgrade.${accountId}.${field}`;

export function initialVersions(base: string): VersionsState {
  return { base, versions: [{ text: base, changes: [] }], active: 0 };
}

/** Adds an upgrade result and makes it the active one. Past MAX_VERSIONS the oldest upgrade (never v0) goes. */
export function addVersion(s: VersionsState, text: string, changes: string[]): VersionsState {
  let versions = [...s.versions, { text, changes }];
  if (versions.length > MAX_VERSIONS) versions = [versions[0], ...versions.slice(versions.length - MAX_VERSIONS + 1)];
  return { ...s, versions, active: versions.length - 1 };
}

export function selectVersion(s: VersionsState, i: number): VersionsState {
  return i >= 0 && i < s.versions.length ? { ...s, active: i } : s;
}

/** What localStorage held, if it is well formed and still starts from the saved text; else null. */
export function parseStoredVersions(raw: string | null, base: string): VersionsState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || v.base !== base || !Array.isArray(v.versions) || v.versions.length < 2) return null;
    const versions: UpgradeVersion[] = v.versions
      .filter((x: any) => x && typeof x.text === "string")
      .map((x: any) => ({ text: x.text, changes: Array.isArray(x.changes) ? x.changes.filter((c: unknown) => typeof c === "string") : [] }));
    if (versions.length < 2 || versions[0].text !== base) return null;
    const active = Number.isInteger(v.active) && v.active >= 0 && v.active < versions.length ? v.active : versions.length - 1;
    return { base, versions, active };
  } catch {
    return null;
  }
}

/** Reasons with their own message under social:upgrade.errors; the rest use the studio messages. */
export const UPGRADE_REASONS = ["no_input", "format", "size", "video_too_long", "result_too_long", "no_speech"] as const;

export function upgradeErrorKey(reason: string | null | undefined): string {
  return reason && (UPGRADE_REASONS as readonly string[]).includes(reason) ? `upgrade.errors.${reason}` : studioErrorKey(reason);
}

/** First characters of a transcript for the video list. */
export function previewText(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
