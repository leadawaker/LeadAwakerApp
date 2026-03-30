import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Bot Photo Crop Modal ─────────────────────────────────────────────────────
export function BotPhotoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const PREVIEW = 240;
  const OUTPUT = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop Bot Photo</DialogTitle>
          <DialogDescription>Drag to reposition · use slider to zoom</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-indigo/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button"
              onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-indigo" />
            <button type="button"
              onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
