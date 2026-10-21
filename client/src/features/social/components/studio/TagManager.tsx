// "Manage tags" inside the tag picker: rename a tag (Enter or leaving the field saves), pick its color
// from the palette, or delete it (asked once, inline). A deleted tag comes off every idea and script.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import { TAG_COLORS, type TagColor } from "@shared/socialStudio";
import { IconBtn } from "@/components/ui/icon-btn";
import { deleteTag, socialTagsKey, tagErrorKey, updateTag, type TagView } from "../../api/tagsApi";
import { socialScriptsKey, socialTopicsKey } from "../../api/studioApi";
import { TAG_COLOR_VAR } from "../../lib/tags";

const swatch = (color: string, on: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", display: "grid", placeItems: "center",
  background: on ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
});

function TagRow({ accountId, tag }: { accountId: number; tag: TagView }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [name, setName] = useState(tag.name);
  const [colors, setColors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const refreshTags = () => qc.invalidateQueries({ queryKey: socialTagsKey(accountId) });
  const save = useMutation({
    mutationFn: (body: { name?: string; color?: TagColor }) => updateTag(accountId, tag.id, body),
    onSuccess: refreshTags,
    onError: () => setName(tag.name),
  });
  const remove = useMutation({
    mutationFn: () => deleteTag(accountId, tag.id),
    onSuccess: () => {
      refreshTags();
      qc.invalidateQueries({ queryKey: socialTopicsKey(accountId) });
      qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) });
    },
  });
  const rename = () => {
    const next = name.replace(/\s+/g, " ").trim();
    if (!next) return setName(tag.name);
    if (next !== tag.name) save.mutate({ name: next });
  };

  if (confirming) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 4px" }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{t("tags.confirmDelete", { name: tag.name })}</p>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="la-btn la-btn--wine" style={{ padding: "5px 10px", minHeight: 30, fontSize: 11.5 }} disabled={remove.isPending} onClick={() => remove.mutate()} data-testid={`tag-delete-yes-${tag.id}`}>
            {remove.isPending && <Loader2 size={11} className="animate-spin" />}{t("tags.delete")}
          </button>
          <button type="button" className="la-btn la-btn--plain" style={{ padding: "5px 10px", minHeight: 30, fontSize: 11.5 }} onClick={() => setConfirming(false)}>{t("tags.cancel")}</button>
        </div>
        {remove.isError && <p role="alert" style={{ margin: 0, fontSize: 11.5, color: "hsl(var(--destructive))" }}>{t("tags.failed")}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-testid={`tag-manage-${tag.id}`}>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <button type="button" style={swatch(TAG_COLOR_VAR[tag.color], colors)} onClick={() => setColors((v) => !v)}
          aria-expanded={colors} aria-label={t("tags.color", { color: t(`tags.colors.${tag.color}`) })} title={t("tags.color", { color: t(`tags.colors.${tag.color}`) })}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: TAG_COLOR_VAR[tag.color] }} aria-hidden />
        </button>
        <input className="neu-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={rename}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          aria-label={t("tags.rename")} style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: "6px 9px" }} />
        <IconBtn onClick={() => setConfirming(true)} title={t("tags.delete")} aria-label={t("tags.delete")} data-testid={`tag-delete-${tag.id}`}>
          <Trash2 className="w-4 h-4" />
        </IconBtn>
      </div>
      {colors && (
        <div className="row" style={{ gap: 0, flexWrap: "wrap" }} role="radiogroup" aria-label={t("tags.colorPick")}>
          {TAG_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === tag.color} style={swatch(TAG_COLOR_VAR[c], c === tag.color)}
              aria-label={t(`tags.colors.${c}`)} title={t(`tags.colors.${c}`)} onClick={() => { if (c !== tag.color) save.mutate({ color: c }); setColors(false); }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: TAG_COLOR_VAR[c], display: "grid", placeItems: "center" }} aria-hidden>
                {c === tag.color && <Check size={10} style={{ color: "var(--on-wine)" }} />}
              </span>
            </button>
          ))}
        </div>
      )}
      {save.isError && <p role="alert" style={{ margin: 0, fontSize: 11.5, color: "hsl(var(--destructive))" }}>{t(tagErrorKey(save.error))}</p>}
    </div>
  );
}

export function TagManager({ accountId, tags, onDone }: { accountId: number; tags: TagView[]; onDone: () => void }) {
  const { t } = useTranslation("social");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="tag-manager">
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <button type="button" className="la-btn la-btn--plain" style={{ padding: "5px 8px", minHeight: 30, fontSize: 11.5 }} onClick={onDone} data-testid="tag-manage-done">
          <ArrowLeft size={12} aria-hidden />{t("tags.done")}
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{t("tags.manage")}</span>
      </div>
      {tags.length === 0 && <p style={{ margin: "2px 4px", fontSize: 12, color: "var(--mute)" }}>{t("tags.none")}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
        {tags.map((tag) => <TagRow key={tag.id} accountId={accountId} tag={tag} />)}
      </div>
    </div>
  );
}
