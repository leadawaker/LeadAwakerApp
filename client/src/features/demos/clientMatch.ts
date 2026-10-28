import type { DemoClientSummary, DemoLang } from "@/features/campaigns/api/demoClientsApi";

// The Client picker's pure side: which clients a search keeps, and how one reads. Only
// `import type` from api files, so it loads in tests without the app's fetch layer.

/** What a Client is called in a list: its label, else its key. */
export function clientLabel(c: DemoClientSummary): string {
  return c.label || c.niche;
}

/** The Clients that match the search: by label, company or key, case-insensitive. A blank search keeps all. */
export function matchingClients(clients: DemoClientSummary[], search: string): DemoClientSummary[] {
  const q = search.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) => [c.label, c.companyName, c.niche].some((s) => (s || "").toLowerCase().includes(q)));
}

/** The chosen Client, or undefined when none is chosen, the list is not loaded, or the key is gone. */
export function findClient(clients: DemoClientSummary[] | undefined, niche: string): DemoClientSummary | undefined {
  return niche ? clients?.find((c) => c.niche === niche) : undefined;
}

/** A Client with no version in the language: its links would be refused. */
export function lacksLanguage(c: DemoClientSummary, language: DemoLang): boolean {
  return !(c.languages ?? []).includes(language);
}
