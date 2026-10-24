// The words on a tool tag: the locale's name for a known tool, else the raw name humanized.
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ToolTagSpec } from "./toolTags";

export function useToolLabel(): (tag: ToolTagSpec) => string {
  const { t } = useTranslation("voiceTab");
  // Stable between renders (the waveform re-labels its markers when this changes).
  return useCallback(
    (tag: ToolTagSpec): string => (tag.known ? t(`test.tools.${tag.key}`, { defaultValue: tag.label }) : tag.label || t("test.tools.other")) as string,
    [t],
  );
}

