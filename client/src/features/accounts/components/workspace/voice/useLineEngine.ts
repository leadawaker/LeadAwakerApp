import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LlmKey } from "./llmOptions";
import { putLineEngine, voiceLineKey, type LineEngine, type LinePurpose } from "./voiceApi";

/** What the line engine card sends: a type change, or the ElevenLabs pick (always with `engine`). */
export interface LineEnginePatch {
  purpose?: LinePurpose;
  engine?: LineEngine;
  engineVoice?: string | null;
  liveLlm?: LlmKey | null;
}

/** Save a line's type or engine pick (agency only); the answer is the fresh line. */
export function useSaveLineEngine(accountId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ numberId, patch }: { numberId: number; patch: LineEnginePatch }) =>
      putLineEngine(accountId, numberId, patch),
    onSuccess: (line) => {
      qc.setQueryData(voiceLineKey(accountId), line);
    },
  });
}
