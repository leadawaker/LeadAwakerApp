import type { ReactNode } from "react";

/** The small uppercase label above each section of the prospect panel. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</h3>;
}
