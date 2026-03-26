// src/features/accounts/pages/pageWidgets/ConfirmToolbarButton.tsx
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { xBase, xDefault, xSpan } from "./accountsPageConstants";

export function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default", confirmYes = "Yes", confirmNo = "No",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
  confirmYes?: string; confirmNo?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="h-9 flex items-center gap-1 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : confirmYes}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>{confirmNo}</button>
      </div>
    );
  }
  // Determine max-w based on label length
  const labelLen = label.length;
  const hoverMaxW = labelLen <= 4 ? "hover:max-w-[80px]" : labelLen <= 6 ? "hover:max-w-[100px]" : "hover:max-w-[120px]";
  return (
    <button
      className={cn(
        xBase, hoverMaxW,
        variant === "danger"
          ? "border-red-300/50 text-red-500 hover:text-red-600"
          : xDefault,
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{label}</span>
    </button>
  );
}
