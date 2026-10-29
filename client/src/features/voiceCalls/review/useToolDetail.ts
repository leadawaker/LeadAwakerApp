// The review's readable reading of a tool (toolDetail.ts) in the page's language, or null
// when the server sent no facts for it.
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ReviewTool } from "./reviewMath";
import { describeTool, type ToolDetail } from "./toolDetail";

export function useToolDetail(): (tool: ReviewTool) => ToolDetail | null {
  const { t, i18n } = useTranslation("voiceTab");
  return useCallback(
    (tool: ReviewTool) => (tool.facts ? describeTool(tool.name, tool.facts, (key, vars) => String(t(`test.facts.${key}`, vars)), i18n.language) : null),
    [t, i18n.language],
  );
}
