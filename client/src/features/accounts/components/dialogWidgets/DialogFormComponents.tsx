// src/features/accounts/components/dialogWidgets/DialogFormComponents.tsx
import React from "react";
import { Label } from "@/components/ui/label";

// ── Section Header ────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5">
      <div className="text-primary">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

// ── Field Row ─────────────────────────────────────────────────────────────────

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-b border-border/40 last:border-0">
      <Label className="text-xs text-muted-foreground pt-2 leading-tight">
        {label}
      </Label>
      <div>{children}</div>
    </div>
  );
}
