// The account's reference images, grouped by kind (people, looks, assets). Tap one to send it with the
// next thumbnail; upload new ones per group. Mia's photos go under People: a presenter cover uses them.
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { REF_KINDS, THUMB_LIMITS, type RefKind } from "@shared/socialThumbnails";
import { SocialApiError } from "../../api/socialApi";
import { deleteThumbnailRef, imageSrc, thumbnailRefsKey, uploadThumbnailRef, type RefView } from "../../api/thumbnailsApi";
import { prepareReference, thumbErrorKey } from "../../lib/thumbnails";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", display: "block" };
const TILE = 58;

function RefTile({ accountId, ref_, selected, canEdit, onToggle }: { accountId: number; ref_: RefView; selected: boolean; canEdit: boolean; onToggle: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteThumbnailRef(accountId, ref_.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: thumbnailRefsKey(accountId) }),
  });
  const name = ref_.label || t(`thumbnails.refs.kinds.${ref_.kind}`);
  return (
    <div style={{ position: "relative", width: TILE, flex: "none" }} data-testid={`thumb-ref-${ref_.id}`}>
      <button type="button" onClick={onToggle} disabled={!canEdit} aria-pressed={selected} title={name} aria-label={name}
        style={{ width: TILE, height: TILE, padding: 0, borderRadius: "var(--r-surface)", overflow: "hidden", display: "block", cursor: canEdit ? "pointer" : "default",
          border: selected ? "2px solid var(--wine)" : "1px solid var(--line)", background: "var(--bone)" }}>
        <img src={imageSrc(ref_.imageUrl)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {selected && (
          <span style={{ position: "absolute", top: 3, left: 3, width: 16, height: 16, borderRadius: "var(--r-pill)", background: "var(--wine)", color: "var(--bone)", display: "grid", placeItems: "center" }}>
            <Check size={11} />
          </span>
        )}
      </button>
      {canEdit && (
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} title={t("thumbnails.refs.delete")} aria-label={t("thumbnails.refs.delete")}
          className="la-btn la-btn--plain" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, minHeight: 20, padding: 0, borderRadius: "var(--r-pill)", display: "grid", placeItems: "center", background: "var(--bone)", border: "1px solid var(--line)" }}>
          {remove.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
        </button>
      )}
      {ref_.label && <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ref_.label}</p>}
    </div>
  );
}

function UploadTile({ accountId, kind }: { accountId: number; kind: RefKind }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const data = await prepareReference(file);
      const label = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, THUMB_LIMITS.refLabel);
      return uploadThumbnailRef(accountId, { kind, label: kind === "person" ? label : "", data });
    },
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: thumbnailRefsKey(accountId) }); },
    onError: (err) => setError(err instanceof SocialApiError ? err.reason : "bad_image"),
  });
  return (
    <div style={{ width: TILE, flex: "none" }}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden multiple
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; files.forEach((f) => upload.mutate(f)); }} />
      <button type="button" className="neu-inset-crisp" onClick={() => fileRef.current?.click()} disabled={upload.isPending} title={t("thumbnails.refs.upload")} aria-label={t("thumbnails.refs.upload")}
        style={{ width: TILE, height: TILE, borderRadius: "var(--r-surface)", display: "grid", placeItems: "center", color: "var(--mute)", border: "1px dashed var(--line)", cursor: "pointer" }}
        data-testid={`thumb-ref-upload-${kind}`}>
        {upload.isPending ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
      </button>
      {error && <p role="alert" style={{ margin: "3px 0 0", fontSize: 10, color: "hsl(var(--destructive))", width: 140 }}>{t(thumbErrorKey(error))}</p>}
    </div>
  );
}

export function ReferencePicker({ accountId, refs, selected, canEdit, onToggle }: {
  accountId: number;
  refs: RefView[];
  selected: number[];
  canEdit: boolean;
  onToggle: (id: number) => void;
}) {
  const { t } = useTranslation("social");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="thumb-refs">
      {REF_KINDS.map((kind) => {
        const list = refs.filter((r) => r.kind === kind);
        if (!canEdit && list.length === 0) return null;
        return (
          <div key={kind}>
            <span style={labelStyle}>{t(`thumbnails.refs.groups.${kind}`)}</span>
            <p style={{ margin: "2px 0 7px", fontSize: 11, color: "var(--mute)" }}>{t(`thumbnails.refs.help.${kind}`)}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
              {list.map((r) => <RefTile key={r.id} accountId={accountId} ref_={r} selected={selected.includes(r.id)} canEdit={canEdit} onToggle={() => onToggle(r.id)} />)}
              {canEdit && <UploadTile accountId={accountId} kind={kind} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
