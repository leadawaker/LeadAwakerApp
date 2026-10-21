// Tags on an idea or a script: the chips, then a "+ tag" chip that opens the picker. Toggles show at
// once and roll back if the save fails. The strip stops clicks, so it can sit inside a clickable card.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchTags, socialTagsKey, type TagView } from "../../api/tagsApi";
import { TAG_COLOR_VAR, tagsFor } from "../../lib/tags";
import { TagPicker } from "./TagPicker";

export function useStudioTags(accountId: number) {
  return useQuery({ queryKey: socialTagsKey(accountId), queryFn: () => fetchTags(accountId), staleTime: 60_000 });
}

export function TagChips({ tags, size = "md" }: { tags: TagView[]; size?: "sm" | "md" }) {
  return (
    <>
      {tags.map((tag) => (
        <Pill key={tag.id} color={TAG_COLOR_VAR[tag.color]} style={size === "sm" ? { fontSize: 10, padding: "3px 7px" } : undefined}>{tag.name}</Pill>
      ))}
    </>
  );
}

const addChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", minHeight: 22, borderRadius: "var(--pill-radius)",
  border: "1px dashed var(--line-strong)", background: "transparent", color: "var(--mute)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
};

export function TagStrip({ accountId, tagIds, onSave, size = "md", compact = false, testId }: {
  accountId: number;
  /** Only a "+" on the add chip, never the word: for quiet lists. */
  compact?: boolean;
  tagIds: number[];
  onSave: (ids: number[]) => Promise<unknown>;
  size?: "sm" | "md";
  testId?: string;
}) {
  const { t } = useTranslation("social");
  const tags = useStudioTags(accountId);
  const [ids, setIds] = useState(tagIds);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = tagIds.join(",");
  useEffect(() => setIds(tagIds), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: number[]) => {
    const before = ids;
    setIds(next);
    setFailed(false);
    onSave(next).catch(() => { setIds(before); setFailed(true); });
  };
  const shown = tagsFor(ids, tags.data ?? []);

  return (
    <div className="row" style={{ gap: 5, flexWrap: "wrap", alignItems: "center" }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} data-testid={testId}>
      <TagChips tags={shown} size={size} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" style={addChip} aria-label={t("tags.edit")} title={t("tags.edit")} data-testid={testId ? `${testId}-add` : undefined}>
            <Plus size={10} aria-hidden />{!compact && shown.length === 0 && t("tags.add")}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2.5" style={{ background: "var(--surface)", border: "none", boxShadow: "var(--sh-raised-crisp)" }}
          onClick={(e) => e.stopPropagation()}>
          <TagPicker accountId={accountId} tags={tags.data ?? []} selected={ids} onChange={change} />
        </PopoverContent>
      </Popover>
      {failed && <span role="alert" style={{ fontSize: 10.5, color: "hsl(var(--destructive))" }}>{t("tags.failed")}</span>}
    </div>
  );
}
