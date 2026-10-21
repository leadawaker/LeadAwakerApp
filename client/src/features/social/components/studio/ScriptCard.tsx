// One script in a list: title, the Manager's answer, rough spoken length, video state and its tags.
// The status is the group header's job. The card is a div so the tag picker (its own buttons) can sit
// in it: the title button selects, clicks in the tag strip stop there.
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";
import { ListCard, Pill } from "@/components/crm/primitives";
import { socialScriptsKey, type ScriptView } from "../../api/studioApi";
import { setScriptTags } from "../../api/tagsApi";
import { spokenSeconds } from "../../lib/studio";
import { TagStrip } from "./TagStrip";

const REVIEW_COLOR: Record<ScriptView["reviewStatus"], string> = { none: "var(--mute-2)", waiting: "var(--warn)", ok: "var(--good)", changes: "hsl(var(--destructive))" };
const plainBtn: React.CSSProperties = { all: "unset", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, width: "100%", cursor: "pointer", boxSizing: "border-box" };

export function ScriptCard({ accountId, script, selected, onSelect }: { accountId: number; script: ScriptView; selected?: boolean; onSelect?: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const secs = script.body.trim() ? spokenSeconds(script.body) : 0;
  const saveTags = async (ids: number[]) => {
    const updated = await setScriptTags(accountId, script.id, ids);
    qc.setQueryData<ScriptView[]>(socialScriptsKey(accountId), (old) => old?.map((s) => (s.id === updated.id ? updated : s)));
  };
  const meta = script.reviewStatus !== "none" || secs > 0 || !!script.videoUploadId;
  return (
    <ListCard as="div" selected={selected} onClick={onSelect} className="w-full text-left" data-testid={`script-card-${script.id}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <button type="button" style={plainBtn} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--wine)] rounded-[6px]" aria-pressed={selected}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{script.title}</span>
          {meta && (
            <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {script.reviewStatus !== "none" && <Pill color={REVIEW_COLOR[script.reviewStatus]}>{t(`scripts.review.${script.reviewStatus}`)}</Pill>}
              {secs > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("scripts.seconds", { seconds: secs })}</span>}
              {script.videoUploadId && <Film size={12} style={{ color: "var(--good)" }} aria-label={t("scripts.videoReady")} />}
            </span>
          )}
        </button>
        <TagStrip accountId={accountId} tagIds={script.tagIds ?? []} onSave={saveTags} testId={`script-tags-${script.id}`} />
      </div>
    </ListCard>
  );
}
