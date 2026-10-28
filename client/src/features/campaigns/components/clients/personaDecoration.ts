import type { ReactNode } from "react";

/** What the Demos page adds to a persona card or row. */
export interface PersonaDecoration {
  /** A small line under the sub line (prospect count). */
  meta?: ReactNode;
  /** Recent unseen activity: wine for a reply, sand for an open. */
  dot?: "reply" | "open" | null;
  /** Accessible name of the dot (the caller translates it). */
  dotLabel?: string;
}
