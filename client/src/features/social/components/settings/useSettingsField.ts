// One editable text of the Socials settings: the local draft, whether it differs from what the
// server holds, and the save mutation. Each card saves on its own, so a half-written text in one
// card never blocks (or gets saved with) another.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialSettingsKey, type SocialSettingsView } from "../../api/studioApi";

export function useSettingsField(accountId: number, serverValue: string, saveFn: (text: string) => Promise<SocialSettingsView>) {
  const qc = useQueryClient();
  const [text, setText] = useState(serverValue);
  useEffect(() => { setText(serverValue); }, [serverValue]);
  const save = useMutation({
    mutationFn: () => saveFn(text),
    onSuccess: (v) => qc.setQueryData(socialSettingsKey(accountId), (old: SocialSettingsView | undefined) => ({ ...old, ...v })),
  });
  return { text, setText, save, dirty: text !== serverValue };
}
