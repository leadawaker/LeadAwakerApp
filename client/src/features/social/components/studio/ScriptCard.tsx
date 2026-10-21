// One script in a list: title, status, the Manager's answer, rough spoken length, video state.
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";
import { ListCard, Pill } from "@/components/crm/primitives";
import type { ScriptView } from "../../api/studioApi";
import { spokenSeconds } from "../../lib/studio";

const REVIEW_COLOR: Record<ScriptView["reviewStatus"], string> = { none: "var(--mute-2)", waiting: "var(--warn)", ok: "var(--good)", changes: "hsl(var(--destructive))" };

export function ScriptCard({ script, selected, onSelect }: { script: ScriptView; selected?: boolean; onSelect?: () => void }) {
  const { t } = useTranslation("social");
  const secs = script.body.trim() ? spokenSeconds(script.body) : 0;
  return (
    <ListCard as="button" selected={selected} onClick={onSelect} className="w-full text-left" data-testid={`script-card-${script.id}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{script.title}</span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Pill color="var(--wine)">{t(`scripts.statuses.${script.status}`)}</Pill>
          {script.reviewStatus !== "none" && <Pill color={REVIEW_COLOR[script.reviewStatus]}>{t(`scripts.review.${script.reviewStatus}`)}</Pill>}
          {secs > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("scripts.seconds", { seconds: secs })}</span>}
          {script.videoUploadId && <Film size={12} style={{ color: "var(--good)" }} aria-label={t("scripts.videoReady")} />}
        </div>
      </div>
    </ListCard>
  );
}
