// The two shared prompts an account's line runs on (Owner only):
// server/routes/voiceAccountPrompts.ts.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export interface VoicePromptRow {
  id: number;
  name: string | null;
  useCase: string;
  promptText: string;
  updatedAt: string | null;
}

export interface AccountVoicePrompts {
  locale: string | null;
  layer: VoicePromptRow | null;
  /** voice_lean_layer_{locale}: what calls run on unless the account picks standard. None for pt. */
  lean?: VoicePromptRow | null;
  backend: VoicePromptRow | null;
  /** eleven_layer_nl / eleven_layer_en: shared by every ElevenLabs line. */
  eleven?: VoicePromptRow | null;
}

export const voicePromptsKey = (accountId: number) => ["/api/accounts", accountId, "voice", "prompts"] as const;

export function useAccountVoicePrompts(accountId: number, locale: string | null) {
  return useQuery({
    // The locale picks the rows: a language change must load the other pair.
    queryKey: [...voicePromptsKey(accountId), locale],
    queryFn: async (): Promise<AccountVoicePrompts> => {
      const res = await apiFetch(`/api/accounts/${accountId}/voice/prompts`);
      if (!res.ok) throw new Error("Failed to load prompts");
      return res.json();
    },
    enabled: accountId > 0,
    // Autosave owns the text once loaded: a background refetch must not
    // replace what is being typed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveVoicePrompt(accountId: number) {
  const qc = useQueryClient();
  return async (promptId: number, promptText: string): Promise<boolean> => {
    const res = await apiFetch(`/api/accounts/${accountId}/voice/prompts/${promptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptText }),
    }).catch(() => null);
    if (!res?.ok) return false;
    // Other accounts in the same language share the row: their cached copy is stale.
    qc.invalidateQueries({ queryKey: ["/api/accounts"], predicate: (q) => q.queryKey.includes("prompts") && q.queryKey[1] !== accountId });
    return true;
  };
}
