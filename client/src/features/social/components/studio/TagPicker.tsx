// The tag picker inside the "+ tag" popover: type to find a tag or make a new one, tap a tag to put it
// on or take it off, and "Manage tags" to rename, recolor or delete the account's tags.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Plus, Settings2 } from "lucide-react";
import { createTag, socialTagsKey, tagErrorKey, type TagView } from "../../api/tagsApi";
import { findTagByName, nextTagColor, TAG_COLOR_VAR, toggleTagId } from "../../lib/tags";
import { TagManager } from "./TagManager";

const rowBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 34, padding: "6px 8px", border: "none",
  borderRadius: 8, background: "transparent", color: "var(--ink-soft)", fontSize: 12.5, textAlign: "left", cursor: "pointer",
};
const dot = (color: string): React.CSSProperties => ({ width: 10, height: 10, borderRadius: "50%", flex: "none", background: color });

export function TagPicker({ accountId, tags, selected, onChange }: {
  accountId: number;
  tags: TagView[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);
  const name = query.replace(/\s+/g, " ").trim();
  const match = name ? findTagByName(tags, name) : undefined;
  const visible = name ? tags.filter((x) => x.name.toLowerCase().includes(name.toLowerCase())) : tags;

  const create = useMutation({
    mutationFn: () => createTag(accountId, name, nextTagColor(tags)),
    onSuccess: (tag) => {
      qc.setQueryData<TagView[]>(socialTagsKey(accountId), (old) => [...(old ?? []), tag].sort((a, b) => a.name.localeCompare(b.name)));
      qc.invalidateQueries({ queryKey: socialTagsKey(accountId) });
      setQuery("");
      onChange([...selected, tag.id]);
    },
  });

  if (managing) return <TagManager accountId={accountId} tags={tags} onDone={() => setManaging(false)} />;

  const submit = () => {
    if (!name) return;
    if (match) { if (!selected.includes(match.id)) onChange([...selected, match.id]); setQuery(""); }
    else if (!create.isPending) create.mutate();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid="tag-picker">
      <input className="neu-input" value={query} maxLength={40} autoFocus onChange={(e) => { setQuery(e.target.value); create.reset(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={t("tags.search")} aria-label={t("tags.search")} style={{ fontSize: 12.5, padding: "7px 10px" }} data-testid="tag-picker-input" />
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
        {tags.length === 0 && !name && <p style={{ margin: "4px 8px", fontSize: 12, color: "var(--mute)" }}>{t("tags.none")}</p>}
        {visible.map((tag) => {
          const on = selected.includes(tag.id);
          return (
            <button key={tag.id} type="button" role="menuitemcheckbox" aria-checked={on} className="hover:bg-card-hover" style={rowBtn}
              onClick={() => onChange(toggleTagId(selected, tag.id))} data-testid={`tag-option-${tag.id}`}>
              <span style={dot(TAG_COLOR_VAR[tag.color])} aria-hidden />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: on ? 700 : 500 }}>{tag.name}</span>
              {on && <Check size={14} style={{ color: "var(--wine)" }} aria-hidden />}
            </button>
          );
        })}
        {name && !match && (
          <button type="button" className="hover:bg-card-hover" style={{ ...rowBtn, color: "var(--wine)", fontWeight: 600 }} disabled={create.isPending} onClick={submit} data-testid="tag-create">
            {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} aria-hidden />}
            {t("tags.create", { name })}
          </button>
        )}
      </div>
      {create.isError && <p role="alert" style={{ margin: 0, fontSize: 11.5, color: "hsl(var(--destructive))" }}>{t(tagErrorKey(create.error))}</p>}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        <button type="button" className="la-btn la-btn--plain" style={{ padding: "5px 8px", minHeight: 30, fontSize: 11.5 }} onClick={() => setManaging(true)} data-testid="tag-manage">
          <Settings2 size={12} aria-hidden />{t("tags.manage")}
        </button>
      </div>
    </div>
  );
}
