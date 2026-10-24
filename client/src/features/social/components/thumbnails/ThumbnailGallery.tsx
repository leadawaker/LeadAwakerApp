// The generated covers, newest first, each at its own format's shape. A card is a spinner while the
// model works, the image when ready (star, download, use the settings again, delete), or the reason it failed.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Download, Loader2, Pencil, RotateCcw, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { approveThumbnail, deleteThumbnail, downloadUrl, imageSrc, starThumbnail, thumbnailsKey, type ThumbnailView } from "../../api/thumbnailsApi";
import { CoverLink } from "./CoverLink";
import { EditThumbnail } from "./EditThumbnail";
import { aspectOf, failureText, galleryItems, type GalleryFilter } from "../../lib/thumbnails";

const iconBtn: React.CSSProperties = { padding: "4px 7px", minHeight: 28, fontSize: 11 };

function ThumbnailCard({ accountId, thumb, canEdit, canLink, onReuse }: { accountId: number; thumb: ThumbnailView; canEdit: boolean; canLink: boolean; onReuse: (t: ThumbnailView) => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const replace = (next: ThumbnailView | null) =>
    qc.setQueryData<ThumbnailView[]>(thumbnailsKey(accountId), (old) => (old ?? []).flatMap((x) => (x.id !== thumb.id ? [x] : next ? [next] : [])));
  const star = useMutation({ mutationFn: () => starThumbnail(accountId, thumb.id, !thumb.starred), onSuccess: replace });
  const remove = useMutation({ mutationFn: () => deleteThumbnail(accountId, thumb.id), onSuccess: () => replace(null) });
  const approve = useMutation({ mutationFn: () => approveThumbnail(accountId, thumb.id), onSuccess: replace });
  const [editing, setEditing] = useState(false);
  const pending = thumb.status === "ready" && thumb.review === "pending";
  const failure = thumb.status === "failed" ? failureText(thumb.error) : null;

  return (
    <li className="neu-raised" style={{ borderRadius: "var(--r-surface)", background: "var(--bone)", padding: 8, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }} data-testid={`thumb-${thumb.id}`}>
      <div className="neu-inset-crisp" style={{ aspectRatio: aspectOf(thumb.format), borderRadius: "var(--r-flush)", overflow: "hidden", display: "grid", placeItems: "center", position: "relative" }}>
        {thumb.status === "ready" && thumb.imageUrl ? (
          <a href={imageSrc(thumb.imageUrl)} target="_blank" rel="noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
            <img src={imageSrc(thumb.imageUrl)} alt={thumb.title || t("thumbnails.gallery.untitled")} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        ) : thumb.status === "generating" ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--mute)", fontSize: 11, padding: 10, textAlign: "center" }}>
            <Loader2 size={18} className="animate-spin" />{t("thumbnails.gallery.generating")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "hsl(var(--destructive))", fontSize: 11, padding: 10, textAlign: "center", overflowWrap: "anywhere" }}>
            <AlertTriangle size={16} />
            {failure && ("key" in failure ? t(failure.key) : failure.text)}
          </div>
        )}
        {thumb.starred && <Star size={14} fill="currentColor" style={{ position: "absolute", top: 6, right: 6, color: "var(--warn)" }} aria-hidden />}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={thumb.title}>
          {thumb.title || t("thumbnails.gallery.untitled")}
        </p>
        <p style={{ margin: 0, fontSize: 10.5, color: "var(--mute)" }}>{t(`thumbnails.kinds.${thumb.kind}.name`)} · {t(`thumbnails.formats.${thumb.format}`)}</p>
        {thumb.parentId && (
          <p style={{ margin: 0, fontSize: 10.5, color: pending ? "var(--warn)" : "var(--mute)", fontWeight: 600 }} data-testid={`thumb-parent-${thumb.id}`}>
            {t(pending ? "thumbnails.edit.pendingFrom" : "thumbnails.edit.editedFrom", { id: thumb.parentId })}
          </p>
        )}
      </div>
      {pending && canEdit && (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="la-btn la-btn--wine" style={{ ...iconBtn, flex: 1 }} disabled={approve.isPending || remove.isPending} onClick={() => approve.mutate()} data-testid={`thumb-approve-${thumb.id}`}>
            {approve.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t("thumbnails.edit.approve")}
          </button>
          <button type="button" className="la-btn la-btn--soft" style={{ ...iconBtn, flex: 1 }} disabled={approve.isPending || remove.isPending} onClick={() => remove.mutate()} data-testid={`thumb-reject-${thumb.id}`}>
            {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}{t("thumbnails.edit.reject")}
          </button>
        </div>
      )}
      <CoverLink accountId={accountId} thumb={thumb} canLink={canLink} />
      <div className="row" style={{ gap: 2, flexWrap: "wrap" }}>
        {thumb.status === "ready" && (
          <a className="la-btn la-btn--plain" style={iconBtn} href={downloadUrl(thumb)} title={t("thumbnails.gallery.download")} aria-label={t("thumbnails.gallery.download")} data-testid={`thumb-download-${thumb.id}`}>
            <Download size={12} />
          </a>
        )}
        {canEdit && (
          <>
            {thumb.status === "ready" && (
              <button type="button" className="la-btn la-btn--plain" style={{ ...iconBtn, color: thumb.starred ? "var(--warn)" : undefined }} disabled={star.isPending} onClick={() => star.mutate()}
                title={t(thumb.starred ? "thumbnails.gallery.unstar" : "thumbnails.gallery.star")} aria-label={t(thumb.starred ? "thumbnails.gallery.unstar" : "thumbnails.gallery.star")} aria-pressed={thumb.starred}>
                <Star size={12} fill={thumb.starred ? "currentColor" : "none"} />
              </button>
            )}
            {thumb.status === "ready" && (
              <button type="button" className="la-btn la-btn--plain" style={{ ...iconBtn, color: editing ? "var(--wine)" : undefined }} aria-expanded={editing} onClick={() => setEditing((e) => !e)}
                title={t("thumbnails.edit.open")} aria-label={t("thumbnails.edit.open")} data-testid={`thumb-edit-open-${thumb.id}`}>
                <Pencil size={12} />
              </button>
            )}
            <button type="button" className="la-btn la-btn--plain" style={iconBtn} onClick={() => onReuse(thumb)} title={t("thumbnails.gallery.reuse")} aria-label={t("thumbnails.gallery.reuse")}>
              <RotateCcw size={12} />
            </button>
            {thumb.status !== "generating" && (
              <button type="button" className="la-btn la-btn--plain" style={{ ...iconBtn, marginLeft: "auto" }} disabled={remove.isPending} onClick={() => remove.mutate()}
                title={t("thumbnails.gallery.delete")} aria-label={t("thumbnails.gallery.delete")} data-testid={`thumb-delete-${thumb.id}`}>
                {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </>
        )}
      </div>
      {editing && canEdit && <EditThumbnail accountId={accountId} thumb={thumb} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function ThumbnailGallery({ accountId, thumbs, loading, canEdit, canLink, onReuse }: {
  accountId: number;
  thumbs: ThumbnailView[];
  loading: boolean;
  canEdit: boolean;
  /** May attach a thumbnail to a post as its Reel cover (agency). */
  canLink: boolean;
  onReuse: (t: ThumbnailView) => void;
}) {
  const { t } = useTranslation("social");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const items = galleryItems(thumbs, filter);
  return (
    <section className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }} data-testid="thumb-gallery">
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", flex: 1 }}>{t("thumbnails.gallery.title")}</h3>
        <div className="la-seg la-seg--pill" role="tablist" aria-label={t("thumbnails.gallery.title")}>
          {(["all", "starred"] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={cn("la-seg-btn", filter === f && "on")} onClick={() => setFilter(f)}>
              {t(`thumbnails.gallery.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div role="status" style={{ padding: 16, color: "var(--mute-2)" }}><Loader2 size={16} className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t(filter === "starred" ? "thumbnails.gallery.emptyStarred" : "thumbnails.gallery.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 2, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, alignItems: "start" }}>
          {items.map((x) => <ThumbnailCard key={x.id} accountId={accountId} thumb={x} canEdit={canEdit} canLink={canLink} onReuse={onReuse} />)}
        </ul>
      )}
    </section>
  );
}
