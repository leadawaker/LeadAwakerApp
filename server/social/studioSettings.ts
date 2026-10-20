// Pure rules for the Socials settings row: what a request may change and what each role is shown.
import type { SocialSettings } from "@shared/schema";
import { isDmMode, TEXT_LIMITS, type DmMode } from "@shared/socialStudio";

export interface SettingsView {
  aboutMe: string;
  /** Agency only from here on: undefined for client users. */
  captionStyle?: string;
  voiceGuide?: string;
  dmMode?: DmMode;
  dmHourlyCap?: number;
  /** INSTAGRAM_DM_LIVE=1 is set on the server: a live mode can really send. */
  dmLiveSwitch?: boolean;
}

export const DEFAULT_DM_HOURLY_CAP = 20;
const MAX_DM_HOURLY_CAP = 200;

export function toSettingsView(row: SocialSettings | null, agency: boolean, dmLiveSwitch: boolean): SettingsView {
  const aboutMe = row?.aboutMe ?? "";
  if (!agency) return { aboutMe };
  return {
    aboutMe,
    captionStyle: row?.captionStyle ?? "",
    voiceGuide: row?.voiceGuide ?? "",
    dmMode: isDmMode(row?.dmMode) ? row!.dmMode as DmMode : "off",
    dmHourlyCap: row?.dmHourlyCap ?? DEFAULT_DM_HOURLY_CAP,
    dmLiveSwitch,
  };
}

type Parsed<T> = { ok: true; fields: T } | { ok: false; message: string };

function text(b: Record<string, unknown>, key: string, max: number): { value?: string; error?: string } {
  if (b[key] === undefined) return {};
  if (typeof b[key] !== "string") return { error: `${key} must be a string` };
  const value = (b[key] as string).replace(/\r\n/g, "\n");
  if (value.length > max) return { error: `${key} is too long` };
  return { value };
}

/** PUT /settings (agency): the caption style, the voice guide and the comment-to-DM mode and cap. */
export function parseAgencySettingsBody(body: unknown): Parsed<Partial<Pick<SocialSettings, "captionStyle" | "voiceGuide" | "dmMode" | "dmHourlyCap" | "aboutMe">>> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, message: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const fields: Partial<Pick<SocialSettings, "captionStyle" | "voiceGuide" | "dmMode" | "dmHourlyCap" | "aboutMe">> = {};
  for (const [key, max] of [["captionStyle", TEXT_LIMITS.captionStyle], ["voiceGuide", TEXT_LIMITS.voiceGuide], ["aboutMe", TEXT_LIMITS.aboutMe]] as const) {
    const r = text(b, key, max);
    if (r.error) return { ok: false, message: r.error };
    if (r.value !== undefined) fields[key] = r.value;
  }
  if (b.dmMode !== undefined) {
    if (!isDmMode(b.dmMode)) return { ok: false, message: "dmMode must be off, dry_run or live" };
    fields.dmMode = b.dmMode;
  }
  if (b.dmHourlyCap !== undefined) {
    const n = b.dmHourlyCap;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_DM_HOURLY_CAP) return { ok: false, message: `dmHourlyCap must be 1 to ${MAX_DM_HOURLY_CAP}` };
    fields.dmHourlyCap = n;
  }
  if (Object.keys(fields).length === 0) return { ok: false, message: "Nothing to change" };
  return { ok: true, fields };
}

/** PUT /settings/about (agency or a Manager of the account): Sobre mim only. */
export function parseAboutBody(body: unknown): Parsed<{ aboutMe: string }> {
  if (typeof body !== "object" || body === null) return { ok: false, message: "Body must be an object" };
  const r = text(body as Record<string, unknown>, "aboutMe", TEXT_LIMITS.aboutMe);
  if (r.error) return { ok: false, message: r.error };
  if (r.value === undefined) return { ok: false, message: "aboutMe is required" };
  return { ok: true, fields: { aboutMe: r.value } };
}
