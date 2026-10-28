// Prospect records and link actions behind the Demos page (server/routes/demoProspects.ts).
// Revoking happens only inside re-mint and delete, so there is no standalone revoke hook.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DemoDeleteResult, DemoProspectDto, DemoProspectSettings, ProspectSettingsResult, RemintResult } from "@shared/demoProspects";
import { apiFetch } from "@/lib/apiUtils";
import { DEMO_SESSIONS_KEY } from "./demoSessionsApi";

export const PROSPECTS_KEY = ["/api/demo/prospects"];

/** An API failure: the server's `message`, plus its `code` (`exists`, `public_demo`, `revoked`) when it sent one. */
export class DemoApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { message?: string; code?: string };
    throw new DemoApiError(err.message || `Request failed (${res.status})`, err.code);
  }
  return data as T;
}

const group = (g: string) => `/api/demo/prospects/${encodeURIComponent(g)}`;
const link = (token: string) => `/api/demo/links/${encodeURIComponent(token)}`;

export function useDemoProspects() {
  return useQuery<DemoProspectDto[]>({
    queryKey: PROSPECTS_KEY,
    queryFn: async () => (await send<{ prospects?: DemoProspectDto[] }>("GET", "/api/demo/prospects")).prospects ?? [],
    staleTime: 30 * 1000,
  });
}

/**
 * Every mutation changes what both lists show, so both are refetched before it settles. A failure
 * refetches too: a refusal (`revoked`, `exists`) means the lists were stale.
 */
function useProspectMutation<V, R>(call: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation<R, Error, V>({
    mutationFn: call,
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: PROSPECTS_KEY }),
        qc.invalidateQueries({ queryKey: DEMO_SESSIONS_KEY }),
      ]),
  });
}

export type NewProspectInput = DemoProspectSettings & { prospectGroup: string; notes?: string; websiteUrl?: string };

export function useCreateProspect() {
  return useProspectMutation<NewProspectInput, DemoProspectDto>(
    async (input) => (await send<{ prospect: DemoProspectDto }>("POST", "/api/demo/prospects", input)).prospect,
  );
}

export function useUpdateProspect() {
  return useProspectMutation<{ group: string; patch: Partial<DemoProspectSettings> & { notes?: string } }, ProspectSettingsResult>(
    ({ group: g, patch }) => send("PATCH", group(g), patch),
  );
}

export function useDeleteProspect() {
  return useProspectMutation<{ group: string }, DemoDeleteResult>(({ group: g }) => send("DELETE", group(g)));
}

export function useDeleteLink() {
  return useProspectMutation<{ token: string }, DemoDeleteResult>(({ token }) => send("DELETE", link(token)));
}

/** Mints a replacement link and revokes the old one. */
export function useRemintLink() {
  return useProspectMutation<{ token: string }, RemintResult>(({ token }) => send("POST", `${link(token)}/remint`));
}
