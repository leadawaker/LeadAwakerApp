// The Variables panel's data for a voice prompt: which placeholders the text
// uses, what the engine's render made of them, the account's stored line for
// editing, and folding a save back in so the preview renders again.
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVoiceLine, voiceLineKey } from "@/features/accounts/components/workspace/voice/voiceApi";
import { detectPromptVariables } from "../../utils/promptVariables";
import { placeholderValues } from "../../utils/voicePlaceholders";
import type { WriteResult, WriteTarget } from "../../utils/variableWrites";

export function useVoiceVariables({ template, rendered, marked, account, own, onRender }: {
  /** The prompt's text in the editor. */
  template: string;
  /** The engine's render of it, with `marked` its values wrapped. */
  rendered: string | null;
  marked: string | null | undefined;
  account: { id: number; name: string } | null;
  /** The render really is this account's line (not the generic fallback). */
  own: boolean;
  /** A value changed: render the preview again. */
  onRender: () => void;
}) {
  const { t } = useTranslation("prompts");
  const qc = useQueryClient();
  const accountId = account?.id ?? 0;
  const lineQuery = useQuery({
    queryKey: voiceLineKey(accountId),
    queryFn: () => fetchVoiceLine(accountId),
    enabled: accountId > 0,
  });
  const line = lineQuery.data ?? null;
  // The variable whose pop-up just saved (a row saves on its own).
  const [popupSaved, setPopupSaved] = useState<string | null>(null);

  const names = useMemo(() => detectPromptVariables(template).names, [template]);
  const values = useMemo(
    () => (rendered === null ? {} : placeholderValues(template, rendered, marked)),
    [template, rendered, marked],
  );

  const target = useMemo<WriteTarget>(() => ({
    voice: account ? { accountId: account.id, accountName: account.name, line, own } : null,
    campaignRaw: null, accountRaw: null, vocabNiche: "", vocabRow: null, packs: null, client: null,
    fieldLang: "en", clientLang: "en",
  }), [account, line, own]);

  const notes = useMemo<Record<string, string>>(() => {
    if (rendered === null) return {};
    const out: Record<string, string> = {};
    // The render left the template here: a client's own greeting replaces the whole row.
    for (const name of names) if (values[name] === undefined && name !== "city") out[name] = t("vars.notInRender");
    // A stored list a call never reads: the line's buying checklist asks its own questions.
    const first = line?.intake?.split("\n")[0]?.trim();
    if (own && first && values.intake !== undefined && !values.intake.includes(first)) out.intake = t("vars.intakeOverridden");
    return out;
  }, [names, values, rendered, line?.intake, own, t]);

  const onSaved = useCallback((r: WriteResult) => {
    if (r.ok && r.voiceLine) qc.setQueryData(voiceLineKey(accountId), r.voiceLine);
    onRender();
  }, [qc, accountId, onRender]);

  const onPopupSaved = useCallback((name: string) => {
    setPopupSaved(name);
    void qc.invalidateQueries({ queryKey: voiceLineKey(accountId) });
    onRender();
  }, [qc, accountId, onRender]);

  return { names, values, target, notes, onSaved, popupSaved, onPopupSaved };
}
