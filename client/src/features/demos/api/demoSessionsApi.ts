import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";
import type { DemoLang } from "@/features/campaigns/api/demoClientsApi";

/** One demo link. Mirrors DemoSessionRow in server/demo-admin.ts. */
export interface DemoSessionSurface {
  /** Whether the lead row exists at all. The browser row is created on first
   *  visit, so `false` means the link was never clicked. */
  opened: boolean;
  /** The moment of that first visit, not an approximation of it. */
  openedAt: string | null;
  replies: number;
  lastAt: string | null;
  status: string;
}

export interface DemoSession {
  token: string;
  /** Both built server-side. The WhatsApp link carries the demo number, which
   *  exists in exactly one place on purpose, so the page never reassembles it. */
  demoUrl: string;
  whatsappUrl: string;
  firstName: string;
  language: string;
  companyName: string;
  clientNiche: string;
  /** "inquired" = no quote, "deciding" = the lead already has one. */
  scenario: string;
  /** Which service column this link belongs in, and which prospect's row.
   *  Both empty on links minted before the page grouped by prospect. */
  service: string;
  prospectGroup: string;
  invited: boolean;
  campaignId: number | null;
  createdAt: string | null;
  browser: DemoSessionSurface;
  whatsapp: DemoSessionSurface;
}

/** Where the CRM's own "open" affordances point.
 *
 * `demoUrl` is the canonical public link (leadawaker.com) and stays exactly
 * that in every copy field: a prospect must never be handed an internal host.
 * Opening it ourselves is a different job. Every host serves the demo page at
 * the same path (Express at /demo/:token, Vercel by rewrite), so pointing the
 * click at the production origin means app.leadawaker.com opens the last
 * pushed build of demo.html while the Pi is running the files being edited.
 * Same path, same origin as the CRM the click came from.
 */
export function demoOpenUrl(demoUrl: string): string {
  try {
    const u = new URL(demoUrl, window.location.origin);
    return window.location.origin + u.pathname + u.search;
  } catch {
    return demoUrl;
  }
}

export interface NewDemoInput {
  firstName: string;
  language: DemoLang;
  campaignId: number;
  clientNiche?: string;
  niche?: string;
  companyName?: string;
  scenario?: "inquired" | "deciding";
  aiDisclosure?: "off" | "opener" | "second_message";
  market?: "uk" | "us" | "nl";
  /** Which offered service this link demos, and which prospect's set of links
   *  it joins. Both are bookkeeping for the Demos page; see SERVICES. */
  service?: string;
  prospectGroup?: string;
}

export interface NewDemoResult {
  demoUrl: string;
  whatsappUrl: string;
  /** False when the niche model did not run and the link carries a generic
   *  fallback persona. It looks identical to a good one, so the page says so. */
  generated?: boolean;
  /** The saved Client this was built from, when one was re-picked. */
  reused?: string;
}

const SESSIONS_KEY = ["/api/demo/sessions"];

export function useDemoSessions() {
  return useQuery<DemoSession[]>({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/demo/sessions");
      if (!res.ok) throw new Error("Failed to load demo sessions");
      return (await res.json()).sessions ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateDemoLink() {
  const qc = useQueryClient();
  return useMutation<NewDemoResult, Error, NewDemoInput>({
    mutationFn: createDemoLink,
    // A new link is a new row in the list behind the form.
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** Mint one link. Shared by the New demo panel and the Demos table, which mint
 *  the same way but do different things with the result. */
export async function createDemoLink(body: NewDemoInput): Promise<NewDemoResult> {
  const res = await apiRequest("POST", "/api/demo/create-link", body);
  return res.json();
}

/**
 * Rename the prospect behind a set of links.
 *
 * Every token in one prospect's row is patched, so a name fixed on the Demos
 * page cannot drift between the services that prospect was sent. The requests
 * go out together: one slow token should not hold up the rest.
 */
export function useUpdateDemoIdentity() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tokens: string[]; firstName?: string; companyName?: string }>({
    mutationFn: async ({ tokens, firstName, companyName }) => {
      const patch = {
        ...(firstName === undefined ? {} : { firstName }),
        ...(companyName === undefined ? {} : { companyName }),
      };
      await Promise.all(tokens.map((t) => apiRequest("PATCH", `/api/demo/${t}/identity`, patch)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export { SESSIONS_KEY as DEMO_SESSIONS_KEY };
