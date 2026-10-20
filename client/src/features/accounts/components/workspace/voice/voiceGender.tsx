// The Voice tab speaks about the receptionist as she or he, following the
// voice: a masculine voice turns "Who she is" into "Who he is". Gendered
// strings have a `_male` variant in the voiceTab locale files; i18next picks
// it through `context`, and falls back to the plain key everywhere else.
import { createContext, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import type { TOptions } from "i18next";
import { isMasculineVoice } from "../communication/setupConstants";

const VoiceGenderContext = createContext<"male" | undefined>(undefined);

export const voiceGender = (voice: string | null | undefined) => (voice && isMasculineVoice(voice) ? "male" : undefined);

export const VoiceGenderProvider = VoiceGenderContext.Provider;

/** `t` for the voiceTab namespace with the receptionist's gender applied. */
export function useVoiceT() {
  const { t, i18n } = useTranslation(["voiceTab", "communicationProfile"]);
  const context = useContext(VoiceGenderContext);
  const vt = useCallback(
    (key: string, options?: TOptions) => t(key, { context, ...options }) as string,
    [t, context],
  );
  return { t: vt, i18n };
}
