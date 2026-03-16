import { createPortal } from "react-dom";
import type { SelectedElementInfo } from "../hooks/useElementPicker";

interface ElementPickerOverlayProps {
  hoveredInfo: SelectedElementInfo | null;
  selectedInfo: SelectedElementInfo | null;
}

function HighlightBox({
  rect,
  color,
  dashed,
  label,
}: {
  rect: DOMRect;
  color: "blue" | "violet";
  dashed?: boolean;
  label?: string;
}) {
  const colors = {
    blue: {
      border: "rgba(96,165,250,0.8)",
      bg: "rgba(59,130,246,0.04)",
    },
    violet: {
      border: "rgba(139,92,246,0.9)",
      bg: "rgba(139,92,246,0.06)",
    },
  };
  const c = colors[color];

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          border: `2px ${dashed ? "dashed" : "solid"} ${c.border}`,
          background: c.bg,
          borderRadius: 4,
          pointerEvents: "none",
          transition: "all 75ms ease-out",
          zIndex: 9998,
        }}
      />
      {label && (
        <div
          style={{
            position: "fixed",
            left: rect.left,
            top: Math.max(0, rect.top - 22),
            pointerEvents: "none",
            zIndex: 9998,
          }}
        >
          <span
            style={{
              background: "rgba(139,92,246,0.95)",
              color: "#fff",
              fontSize: 10,
              fontFamily: "monospace",
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>
      )}
    </>
  );
}

export function ElementPickerOverlay({ hoveredInfo, selectedInfo }: ElementPickerOverlayProps) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
      {hoveredInfo && (!selectedInfo || hoveredInfo.element !== selectedInfo.element) && (
        <HighlightBox rect={hoveredInfo.rect} color="blue" dashed />
      )}
      {selectedInfo && (
        <HighlightBox
          rect={selectedInfo.rect}
          color="violet"
          label={
            selectedInfo.componentName
              ? `${selectedInfo.componentName} <${selectedInfo.tagName}>`
              : `<${selectedInfo.tagName}>`
          }
        />
      )}
    </div>,
    document.body,
  );
}
