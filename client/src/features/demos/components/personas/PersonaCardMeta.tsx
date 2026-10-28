import { useTranslation } from "react-i18next";
import type { ProspectSummary } from "../../personaDemos";

/** The line under a persona's sub line: "2 prospects · 1 replied", else "· 1 opened" (a reply wins). */
export function PersonaCardMeta({ summary }: { summary: ProspectSummary }) {
  const { t } = useTranslation("demos");
  if (summary.prospects === 0) return null;
  const parts = [t("merge.meta.prospects", { count: summary.prospects })];
  if (summary.replied > 0) parts.push(t("merge.meta.replied", { count: summary.replied }));
  else if (summary.opened > 0) parts.push(t("merge.meta.opened", { count: summary.opened }));
  return <>{parts.join(" · ")}</>;
}
