/**
 * The five term groups of a demo persona. A pure module (no api imports) so the
 * editor's draft logic and its tests can use the list without loading
 * demoClientsApi, which reads `import.meta.env`; the api file re-exports it.
 *
 * Unlike the long text fields these MUST exist per language: they are
 * substituted verbatim into the opener with no model in the loop, so an English
 * term on a Dutch demo goes out as "je staircase".
 */
export const TERM_GROUPS = ["project", "proposal", "decision", "advisor", "visit"] as const;
export type TermGroup = (typeof TERM_GROUPS)[number];
