// From this window width the test panel is a sticky column beside the Voice tab's
// open section (every section); below it the panel sits inline in Prompt & test.
import { useEffect, useState } from "react";

export const TEST_PANEL_WIDE_PX = 1440;
/** The column's width on wide screens; the Voice tab keeps the 1386px content cap. */
export const TEST_PANEL_COLUMN_PX = 380;

const query = `(min-width: ${TEST_PANEL_WIDE_PX}px)`;

export function useWideTestPanel(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setWide(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
}
