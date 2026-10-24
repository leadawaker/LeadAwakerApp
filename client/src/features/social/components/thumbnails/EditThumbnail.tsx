// Ask for changes to a finished thumbnail: what to change, optionally a new format, and how many
// versions. The new versions come back linked to this one and wait for approval in the gallery.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Wand2 } from "lucide-react";
import { THUMB_FORMATS, THUMB_LIMITS, type ThumbFormat } from "@shared/socialThumbnails";
import { cn } from "@/lib/utils";
import { SocialApiError } from "../../api/socialApi";
import { editThumbnail, thumbnailsKey, type ThumbnailView } from "../../api/thumbnailsApi";
import { thumbErrorKey } from "../../lib/thumbnails";

export function EditThumbnail({ accountId, thumb, onDone }: { accountId: number; thumb: ThumbnailView; onDone: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const own = (THUMB_FORMATS as readonly string[]).includes(thumb.format) ? (thumb.format as ThumbFormat) : THUMB_FORMATS[0];
  const [instruction, setInstruction] = useState("");
  const [format, setFormat] = useState<ThumbFormat>(own);
  const [variants, setVariants] = useState(2);

  const send = useMutation({
    mutationFn: () => editThumbnail(accountId, thumb.id, { instruction: instruction.trim(), format: format === own ? null : format, variants }),
    onSuccess: (rows) => {
      qc.setQueryData<ThumbnailView[]>(thumbnailsKey(accountId), (old) => [...rows, ...(old ?? [])]);
      onDone();
    },
  });
  const reason = send.error instanceof SocialApiError ? send.error.reason : send.error ? "failed" : null;
  const ready = instruction.trim().length > 0 || format !== own;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid={`thumb-edit-${thumb.id}`}>
      <textarea className="neu-input" rows={3} value={instruction} maxLength={THUMB_LIMITS.prompt} onChange={(e) => setInstruction(e.target.value)}
        placeholder={t("thumbnails.edit.placeholder")} aria-label={t("thumbnails.edit.placeholder")} style={{ fontSize: 12, padding: "7px 9px", width: "100%", resize: "vertical" }} data-testid={`thumb-edit-text-${thumb.id}`} />
      <select className="neu-input" value={format} onChange={(e) => setFormat(e.target.value as ThumbFormat)} aria-label={t("thumbnails.composer.format")} style={{ fontSize: 12, padding: "5px 8px" }}>
        {THUMB_FORMATS.map((f) => <option key={f} value={f}>{t(`thumbnails.formats.${f}`)}{f === own ? ` (${t("thumbnails.edit.current")})` : ""}</option>)}
      </select>
      <div className="la-seg la-seg--pill" role="radiogroup" aria-label={t("thumbnails.composer.variants")} style={{ alignSelf: "flex-start" }}>
        {Array.from({ length: THUMB_LIMITS.variants }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={variants === n} className={cn("la-seg-btn", variants === n && "on")} onClick={() => setVariants(n)}>{n}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="la-btn la-btn--wine" style={{ padding: "4px 10px", minHeight: 28, fontSize: 11.5 }} disabled={!ready || send.isPending} onClick={() => send.mutate()} data-testid={`thumb-edit-send-${thumb.id}`}>
          {send.isPending ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}{t("thumbnails.edit.send")}
        </button>
        <button type="button" className="la-btn la-btn--plain" style={{ padding: "4px 8px", minHeight: 28, fontSize: 11.5 }} disabled={send.isPending} onClick={onDone}>{t("thumbnails.edit.cancel")}</button>
      </div>
      {reason && <p role="alert" style={{ margin: 0, fontSize: 11, color: "hsl(var(--destructive))" }}>{t(thumbErrorKey(reason))}</p>}
    </div>
  );
}
