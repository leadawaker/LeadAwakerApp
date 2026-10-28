/** What the persona list shows as a row's picture. Pure: building the URL (which needs the API origin) is the component's job. */
import type { DemoClientSummary } from "../../api/demoClientsApi";

export interface ThumbSource {
  kind: "logo" | "screenshot";
  /** A file name served by /api/site-shot/. */
  file: string;
}

/**
 * The pictures to try, best first: the persona's logo, then the screenshot of
 * its website. Empty means the neutral initial. The component steps down this
 * list when an image fails to load.
 */
export function thumbSources(c: Partial<Pick<DemoClientSummary, "logo" | "screenshot">>): ThumbSource[] {
  const out: ThumbSource[] = [];
  if (c.logo) out.push({ kind: "logo", file: c.logo });
  if (c.screenshot) out.push({ kind: "screenshot", file: c.screenshot });
  return out;
}

/** The first letter or digit of a name, upper case; "" when it has none. */
export function thumbInitial(name: string): string {
  const m = name.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toLocaleUpperCase() : "";
}
