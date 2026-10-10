import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUnassignedNumbers, fetchVoiceLine, putVoiceLine, voiceLineKey, UNASSIGNED_KEY,
  type VoiceLine, type VoiceLinePatch,
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

  // The last wiring sync's result. Only a PUT that can move a number carries
  // one, so it is kept here: the GET refetch and unrelated saves must not hide
  // a number left on the wrong route.
  const [wiring, setWiring] = useState<VoiceLine["wiring"]>(undefined);
  const mutation = useMutation({
    mutationFn: (patch: VoiceLinePatch) => putVoiceLine(accountId, patch),
    onSuccess: (line) => {
      if (line.wiring !== undefined) setWiring(line.wiring);
      qc.setQueryData(voiceLineKey(accountId), line);
      // Attaching or detaching a number changes which rows are still free.
      qc.invalidateQueries({ queryKey: UNASSIGNED_KEY });
    },
  });

  const line = useMemo(
    () => (query.data ? { ...query.data, wiring } : null),
    [query.data, wiring],
  );

  return {
    line,
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
