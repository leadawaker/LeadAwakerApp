// A chat photo, larger, in a popup with a "Download full size" button.
// Inbound photos are stored as data: URLs, which browsers refuse to open in a
// new tab, so they are shown here and downloaded through a blob instead.
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** "photo-2026-10-15-1432.jpg", or `<base>-2026-10-15-1432.jpg` when a name is given. */
function fileName(mime: string, base?: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const slug = (base ?? "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  return `${slug || "photo"}-${stamp}.${EXT[mime] ?? "jpg"}`;
}

function downloadImage(url: string, base?: string) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  const a = document.createElement("a");
  let objectUrl: string | null = null;
  if (m) {
    const mime = m[1] || "image/jpeg";
    const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    a.href = objectUrl;
    a.download = fileName(mime, base);
  } else {
    // A hosted file: same-origin downloads, cross-origin opens in a new tab.
    a.href = url;
    a.download = decodeURIComponent(url.split("/").pop()?.split("?")[0] || fileName("image/jpeg", base));
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
}

export function ImageLightbox({ url, open, onOpenChange, downloadName }: {
  url: string; open: boolean; onOpenChange: (open: boolean) => void; downloadName?: string;
}) {
  const { t } = useTranslation("conversations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-32px)] max-w-[1100px] gap-3 rounded-[var(--r-panel)] bg-card p-3 pt-12 sm:rounded-[var(--r-panel)]"
        data-testid="image-lightbox"
      >
        <DialogTitle className="sr-only">{t("chat.photoTitle")}</DialogTitle>
        <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
          <img src={url} alt={t("chat.attachment")} className="block max-h-[75vh] w-auto max-w-full object-contain" />
        </div>
        <div className="flex justify-end">
          <button type="button" className="la-btn la-btn--wine" onClick={() => downloadImage(url, downloadName)}
            data-testid="image-lightbox-download">
            <Download className="h-4 w-4" /> {t("chat.downloadFullSize")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
