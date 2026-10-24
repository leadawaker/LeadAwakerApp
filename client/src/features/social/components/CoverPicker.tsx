// The Reel cover of a post: a thumbnail from the account's gallery (Thumbnails tab). Shown inside
// PostSheet. Only ready Reel-format (9:16) thumbnails are offered; Instagram crops anything else.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/apiUtils";
import { fetchThumbnails, imageSrc, thumbnailsKey } from "../api/thumbnailsApi";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };

export function CoverPicker({ accountId, value, previewUrl, onChange }: {
  accountId: number;
  /** The chosen thumbnail id, null for no cover. */
  value: number | null;
  /** What to show for the current cover: the post's own cover copy, or the thumbnail just picked. */
  previewUrl: string | null;
  onChange: (thumbnailId: number | null, previewUrl: string | null) => void;
}) {
  const { t } = useTranslation("accounts");
  const [open, setOpen] = useState(false);
  const thumbs = useQuery({ queryKey: thumbnailsKey(accountId), queryFn: () => fetchThumbnails(accountId), enabled: open });
  const choices = (thumbs.data ?? []).filter((x) => x.status === "ready" && x.format === "reel" && !!x.imageUrl);
  const shown = value !== null && previewUrl ? (previewUrl.startsWith("/media/") ? `${API_BASE}${previewUrl}` : imageSrc(previewUrl)) : "";

  return (
    <div data-testid="social-cover">
      <span style={labelStyle}>{t("social.posts.sheet.cover")}</span>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        {shown ? (
          <img src={shown} alt={t("social.posts.sheet.cover")} style={{ width: 72, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: "var(--r-surface)", flexShrink: 0 }} />
        ) : (
          <div className="neu-inset-crisp" style={{ width: 72, aspectRatio: "9 / 16", borderRadius: "var(--r-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--mute-2)" }}>
            <ImageIcon size={16} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--soft" onClick={() => setOpen((o) => !o)} data-testid="social-cover-choose">
              {t(value === null ? "social.posts.sheet.chooseCover" : "social.posts.sheet.changeCover")}
            </button>
            {value !== null && (
              <button type="button" className="la-btn la-btn--plain" onClick={() => onChange(null, null)} data-testid="social-cover-remove">
                {t("social.posts.sheet.removeCover")}
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)", lineHeight: 1.5 }}>{t("social.posts.sheet.coverHelp")}</p>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {thumbs.isLoading && <Loader2 size={14} className="animate-spin" />}
          {thumbs.isError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t("social.posts.errors.failed")}</p>}
          {thumbs.isSuccess && choices.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("social.posts.sheet.coverEmpty")}</p>}
          {choices.length > 0 && (
            <div role="listbox" aria-label={t("social.posts.sheet.cover")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
              {choices.map((x) => (
                <button key={x.id} type="button" role="option" aria-selected={value === x.id}
                  onClick={() => { onChange(x.id, x.imageUrl); setOpen(false); }}
                  className={cn("neu-inset-crisp", value === x.id && "on")}
                  style={{ padding: 0, border: value === x.id ? "2px solid var(--wine)" : "2px solid transparent", borderRadius: "var(--r-surface)", overflow: "hidden", cursor: "pointer", background: "none" }}
                  data-testid={`social-cover-option-${x.id}`}>
                  <img src={imageSrc(x.imageUrl!)} alt={x.title || `#${x.id}`} loading="lazy" style={{ width: "100%", aspectRatio: "9 / 16", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
