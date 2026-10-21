// A 9:16 video preview with an "enlarge" button in its corner. The button opens a dialog with a
// much bigger player (sized to the viewport, never browser-fullscreen) and optional footer content
// (the post's approve / request-changes buttons), so the manager can decide while watching big.
// The dialog content unmounts on close, which stops the video.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function VideoPreview({ src, title, showEnlarge = true, footer, testId }: {
  src: string;
  /** Dialog title: a caption snippet or the post date. */
  title: string;
  showEnlarge?: boolean;
  /** Rendered under the big player; receives a function that closes the dialog. */
  footer?: (close: () => void) => ReactNode;
  testId?: string;
}) {
  const { t } = useTranslation("accounts");
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", width: 96, flexShrink: 0 }}>
      <video
        src={src}
        preload="metadata"
        controls
        playsInline
        aria-label={t("social.posts.previewLabel")}
        style={{ display: "block", width: 96, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: "var(--r-surface)", background: "var(--bg)" }}
      />
      {showEnlarge && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("social.posts.enlargeVideo")}
          title={t("social.posts.enlargeVideo")}
          data-testid={testId ?? "video-enlarge"}
          style={{
            position: "absolute", top: 4, right: 4, width: 32, height: 32, borderRadius: "var(--r-pill)",
            display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer",
            background: "rgba(0, 0, 0, 0.55)", color: "#fff",
          }}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(94vw,440px)] gap-3 p-4" data-testid="video-lightbox">
          <DialogTitle className="truncate pr-8 text-sm font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{t("social.posts.previewLabel")}</DialogDescription>
          <video
            src={src}
            controls
            autoPlay
            playsInline
            aria-label={t("social.posts.previewLabel")}
            style={{
              display: "block", margin: "0 auto", aspectRatio: "9 / 16", width: "min(100%, calc(68vh * 9 / 16))",
              objectFit: "contain", borderRadius: "var(--r-surface)", background: "#000",
            }}
          />
          {footer?.(() => setOpen(false))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
