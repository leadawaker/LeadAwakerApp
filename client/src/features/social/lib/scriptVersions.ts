// Versions of one script while Gabriel works on it with "Improve with AI". v0 is the saved text
// ("Original", never lost); every AI pass is a new version; text he typed over a version is kept as an
// "edit" version before he flips away or asks the AI again. Nothing reaches the server until Save.
// Mirrored to localStorage per script so a refresh or a closed panel does not lose them. Pure.

export type VersionKind = "original" | "ai" | "edit";
export interface ScriptVersion { kind: VersionKind; body: string; title: string | null; notes: string }
export interface VersionState { versions: ScriptVersion[]; index: number }

/** Original plus the newest passes; older passes drop out first. */
export const MAX_VERSIONS = 20;

export function initialVersions(savedBody: string): VersionState {
  return { versions: [{ kind: "original", body: savedBody, title: null, notes: "" }], index: 0 };
}

export const hasUnsaved = (s: VersionState) => s.versions.length > 1;

function capped(s: VersionState): VersionState {
  const extra = s.versions.length - MAX_VERSIONS;
  if (extra <= 0) return s;
  const versions = [s.versions[0], ...s.versions.slice(1 + extra)];
  return { versions, index: s.index === 0 ? 0 : Math.max(1, s.index - extra) };
}

/** Text typed over the shown version becomes its own version, so flipping away never loses it. */
export function withSnapshot(s: VersionState, currentBody: string): VersionState {
  if (currentBody === s.versions[s.index]?.body) return s;
  const versions = [...s.versions, { kind: "edit" as const, body: currentBody, title: null, notes: "" }];
  return capped({ versions, index: versions.length - 1 });
}

export function withImproved(s: VersionState, sentBody: string, result: { title: string; body: string }, notes: string): VersionState {
  const base = withSnapshot(s, sentBody);
  const versions = [...base.versions, { kind: "ai" as const, body: result.body, title: result.title || null, notes }];
  return capped({ versions, index: versions.length - 1 });
}

export function withSelected(s: VersionState, currentBody: string, index: number): VersionState {
  if (index < 0 || index >= s.versions.length) return s;
  // A snapshot appends at the end, so the index picked still points at the same version.
  return { ...withSnapshot(s, currentBody), index };
}

// ─── localStorage mirror ─────────────────────────────────────────────────────

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const versionsKey = (accountId: number, scriptId: number) => `la-social-script-versions:${accountId}:${scriptId}`;

function storage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function isVersion(v: unknown): v is ScriptVersion {
  const x = v as ScriptVersion;
  return !!x && (x.kind === "original" || x.kind === "ai" || x.kind === "edit") && typeof x.body === "string"
    && (x.title === null || typeof x.title === "string") && typeof x.notes === "string";
}

export function loadVersions(key: string, store: StorageLike | null = storage()): VersionState | null {
  try {
    const raw = store?.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as VersionState;
    if (!Array.isArray(d.versions) || !d.versions.every(isVersion) || d.versions[0]?.kind !== "original") return null;
    const s = { versions: d.versions, index: Number.isInteger(d.index) && d.index >= 0 && d.index < d.versions.length ? d.index : d.versions.length - 1 };
    return hasUnsaved(s) ? s : null;
  } catch {
    return null;
  }
}

/** Only unsaved work is kept; a lone Original is the saved script, so the entry is removed. */
export function saveVersions(key: string, s: VersionState, store: StorageLike | null = storage()): void {
  try {
    if (hasUnsaved(s)) store?.setItem(key, JSON.stringify(s));
    else store?.removeItem(key);
  } catch { /* private mode or full: the versions still live in the panel */ }
}

export function clearVersions(key: string, store: StorageLike | null = storage()): void {
  try { store?.removeItem(key); } catch { /* nothing to clear */ }
}
