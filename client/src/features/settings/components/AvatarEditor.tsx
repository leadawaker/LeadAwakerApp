import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

/**
 * Round avatar with click-to-upload, a crop/zoom dialog and a remove button.
 * Produces a 256px JPEG data URL via `onChange`; saving is the caller's job.
 */
export function AvatarEditor({
  avatarUrl,
  initials,
  onChange,
}: {
  avatarUrl: string;
  initials: string;
  onChange: (url: string) => void;
}) {
  const { t } = useTranslation("settings");
  const isMobile = useIsMobile();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Crop dialog state ─────────────────────────────────────────────
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const cropDragging = useRef(false);
  const cropLastPointer = useRef({ x: 0, y: 0 });

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropImage(reader.result);
        setCropZoom(1);
        setCropPos({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropConfirm = useCallback(() => {
    if (!cropImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const imgSize = Math.min(img.width, img.height);
      const cropSize = imgSize / cropZoom;
      const cx = (img.width - cropSize) / 2 - (cropPos.x / 100) * imgSize;
      const cy = (img.height - cropSize) / 2 - (cropPos.y / 100) * imgSize;
      ctx.drawImage(img, cx, cy, cropSize, cropSize, 0, 0, size, size);
      onChange(canvas.toDataURL("image/jpeg", 0.85));
      setCropImage(null);
    };
    img.src = cropImage;
  }, [cropImage, cropZoom, cropPos, onChange]);

  const handleCropPointerDown = useCallback((e: React.PointerEvent) => {
    cropDragging.current = true;
    cropLastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cropDragging.current) return;
    const dx = e.clientX - cropLastPointer.current.x;
    const dy = e.clientY - cropLastPointer.current.y;
    cropLastPointer.current = { x: e.clientX, y: e.clientY };
    // Convert pixel movement to percentage (relative to 200px preview area)
    const sensitivity = 100 / 200;
    setCropPos((prev) => {
      const maxOffset = (cropZoom - 1) * 50 / cropZoom;
      return {
        x: Math.max(-maxOffset, Math.min(maxOffset, prev.x + dx * sensitivity)),
        y: Math.max(-maxOffset, Math.min(maxOffset, prev.y + dy * sensitivity)),
      };
    });
  }, [cropZoom]);

  const handleCropPointerUp = useCallback(() => {
    cropDragging.current = false;
  }, []);

  return (
    <>
      <div className="relative shrink-0 group/avatar">
        <div
          className={cn(
            "h-[72px] w-[72px] rounded-full overflow-hidden cursor-pointer ring-2 ring-border/20 ring-offset-2 ring-offset-card",
            !avatarUrl && "flex items-center justify-center text-xl font-bold",
          )}
          onClick={() => avatarInputRef.current?.click()}
          title={t("profile.clickToUpload")}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t("profile.avatarAlt")}
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-full w-full rounded-full bg-brand-indigo text-white flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
          )}
        </div>
        {/* Camera overlay on hover (always visible at low opacity on mobile) */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-black/40 flex items-center justify-center transition-opacity cursor-pointer pointer-events-none",
            isMobile ? "opacity-40" : "opacity-0 group-hover/avatar:opacity-100",
          )}
        >
          <Camera className="w-6 h-6 text-white" />
        </div>
        {/* Remove button: hover-only, top-right */}
        {avatarUrl && (
          <button
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center text-foreground/50 hover:text-destructive transition-colors z-10 opacity-0 group-hover/avatar:opacity-100"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            title={t("profile.removePhoto")}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      {/* ── Crop/Zoom Dialog ──────────────────────────────── */}
      <Dialog open={!!cropImage} onOpenChange={(open) => { if (!open) setCropImage(null); }}>
        <DialogContent className="max-w-[90vw] sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{t("cropDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Circular crop preview */}
            <div
              className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-2 border-border bg-muted cursor-grab active:cursor-grabbing select-none touch-none"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              {cropImage && (
                <img
                  src={cropImage}
                  alt={t("cropDialog.previewAlt")}
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{
                    transform: `scale(${cropZoom}) translate(${cropPos.x}%, ${cropPos.y}%)`,
                    transformOrigin: "center center",
                  }}
                />
              )}
            </div>
            {/* Zoom slider */}
            <div className="w-full flex items-center gap-3 px-2">
              <span className="text-xs text-muted-foreground shrink-0">1x</span>
              <Slider
                min={1}
                max={3}
                step={0.1}
                value={[cropZoom]}
                onValueChange={([v]) => {
                  setCropZoom(v);
                  // Clamp position when zoom decreases
                  const maxOffset = (v - 1) * 50 / v;
                  setCropPos((prev) => ({
                    x: Math.max(-maxOffset, Math.min(maxOffset, prev.x)),
                    y: Math.max(-maxOffset, Math.min(maxOffset, prev.y)),
                  }));
                }}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground shrink-0">3x</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button type="button" onClick={() => setCropImage(null)} className="la-btn la-btn--soft">
              {t("cropDialog.cancel")}
            </button>
            <button type="button" onClick={handleCropConfirm} className="la-btn la-btn--wine">
              {t("cropDialog.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
