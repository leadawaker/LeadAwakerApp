import type { CSSProperties } from "react";
import type { DemoClientSummary, DemoLang } from "../../api/demoClientsApi";

export const LANGS: DemoLang[] = ["en", "nl", "pt"];

type Named = Pick<DemoClientSummary, "niche" | "label" | "companyName">;

/**
 * A persona as two lines instead of one joined string: the company it plays
 * (or the niche, for a pack with no company), then whatever else identifies it.
 */
export function clientNames(client: Named): { title: string; sub: string } {
  const title = client.companyName || client.niche;
  const seen = new Set([title.toLowerCase()]);
  const rest: string[] = [];
  for (const part of [client.label, client.niche]) {
    const key = (part ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rest.push(part.trim());
  }
  return { title, sub: rest.join(" · ") };
}

/** Languages that have text in at least one of the given slots. */
export function filledLangs(slots: Array<Partial<Record<DemoLang, string>> | undefined>): DemoLang[] {
  return LANGS.filter((l) => slots.some((s) => (s?.[l] ?? "").trim()));
}

/** Hands `rows` to clients.css as a text box's starting height (it grows with its text from there). */
export const rowsVar = (rows: number) => ({ "--dp-rows": rows }) as CSSProperties;
