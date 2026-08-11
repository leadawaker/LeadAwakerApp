/**
 * The Clients library (specs/demo-persona-library) — a saved demo persona.
 *
 * A Client IS a Niche_Vocabulary row. Named "Clients" in the UI because that is
 * what it represents to Gabriel: the prospect a demo is dressed up as.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";

export type DemoLang = "en" | "nl" | "pt";

/** A per-language text slot. Partial: a Client may exist in one language only. */
export type NicheText = Partial<Record<DemoLang, string>>;

/**
 * The long-text fields. All of these are read by the model, which then writes
 * in the lead's language, so English alone is enough (verified 2026-08-11: an
 * English kb and ladder produced native Dutch). The editor shows English and
 * treats the other slots as optional.
 */
export const CLIENT_TEXT_FIELDS = [
  "nicheLabel",
  "companyNameTemplate",
  "serviceName",
  "usp",
  "descriptionTemplate",
  "kbTemplate",
  "nicheQuestion",
  "enquiryContext",
  "quoteContext",
  "scopingLadder",
  "openerPhrase",
  "firstMessage",
  "questionBank",
  "objectionExamples",
  "whenLabel",
] as const;

export type ClientTextField = (typeof CLIENT_TEXT_FIELDS)[number];

/**
 * The five term groups. Unlike the text fields these MUST exist per language:
 * they are substituted verbatim into the opener with no model in the loop, so
 * an English term on a Dutch demo goes out as "je staircase".
 */
export const TERM_GROUPS = ["project", "proposal", "decision", "advisor", "visit"] as const;
export type TermGroup = (typeof TERM_GROUPS)[number];

export interface DemoClientSummary {
  id: number;
  niche: string;
  label: string;
  companyName: string;
  languages: DemoLang[];
  /** False for the curated niche packs: listed and editable, never deletable. */
  isDemoClient: boolean;
  updatedAt: string | null;
}

export interface EditableDemoClient {
  id: number;
  niche: string;
  bookingModeCall: boolean;
  isDemoClient: boolean;
  updatedAt: string | null;
  text: Record<ClientTextField, NicheText>;
  terms: Record<TermGroup, Record<DemoLang, string[]>>;
}

export interface DemoClientPatch {
  /** Merged per slot: sending only `{ en }` leaves nl and pt untouched. */
  text?: Partial<Record<ClientTextField, NicheText>>;
  /** Replaced per language: the editor shows the whole list, so removal works. */
  terms?: Partial<Record<TermGroup, Partial<Record<DemoLang, string[]>>>>;
  bookingModeCall?: boolean;
}

const CLIENTS_KEY = ["/api/demo/clients"];

export function useDemoClients() {
  return useQuery<DemoClientSummary[]>({
    queryKey: CLIENTS_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/demo/clients");
      if (!res.ok) throw new Error("Failed to load Clients");
      return (await res.json()).clients ?? [];
    },
    staleTime: 60 * 1000,
  });
}

export function useDemoClient(niche: string | null) {
  return useQuery<EditableDemoClient | null>({
    queryKey: [...CLIENTS_KEY, niche],
    enabled: Boolean(niche),
    queryFn: async () => {
      const res = await apiFetch(`/api/demo/clients/${encodeURIComponent(niche!)}`);
      if (!res.ok) throw new Error("Failed to load Client");
      return (await res.json()).client ?? null;
    },
  });
}

export function useUpdateDemoClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ niche, patch }: { niche: string; patch: DemoClientPatch }) =>
      apiRequest("PATCH", `/api/demo/clients/${encodeURIComponent(niche)}`, patch).then((r) => r.json()),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, vars.niche] });
    },
  });
}

export function useDeleteDemoClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (niche: string) =>
      apiRequest("DELETE", `/api/demo/clients/${encodeURIComponent(niche)}`).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
