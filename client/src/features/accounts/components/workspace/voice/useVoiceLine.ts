import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUnassignedNumbers, fetchVoiceLine, putVoiceLine, voiceLineKey, UNASSIGNED_KEY,
  type VoiceLinePatch,
} from "./voiceApi";

/** The account's voice line (GET) plus a save mutation (PUT) that returns the fresh line. */
export function useVoiceLine(accountId: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: voiceLineKey(accountId),
    queryFn: () => fetchVoiceLine(accountId),
    enabled: accountId > 0,
    staleTime: 15 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (patch: VoiceLinePatch) => putVoiceLine(accountId, patch),
    onSuccess: (line) => {
      qc.setQueryData(voiceLineKey(accountId), line);
      // Attaching or detaching a number changes which rows are still free.
      qc.invalidateQueries({ queryKey: UNASSIGNED_KEY });
    },
  });

  return {
    line: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    saving: mutation.isPending,
    saveError: mutation.error as Error | null,
    /** Resolves true on success, false on failure (the error is on `saveError`). */
    save: async (patch: VoiceLinePatch): Promise<boolean> => {
      try {
        await mutation.mutateAsync(patch);
        return true;
      } catch {
        return false;
      }
    },
    refetch: query.refetch,
  };
}

/** Unassigned Voice_Numbers rows (agency only). */
export function useUnassignedNumbers(enabled: boolean) {
  return useQuery({
    queryKey: UNASSIGNED_KEY,
    queryFn: fetchUnassignedNumbers,
    enabled,
    staleTime: 30 * 1000,
  });
}
