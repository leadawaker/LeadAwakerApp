import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** A labelled field for the Demos panels: the label (with a `*` when required), the control, then an optional hint. */
export function FormField({ label, htmlFor, required, hint, children }: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--wine)" }}>
            {" *"}
          </span>
        )}
      </Label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: "var(--mute)" }}>{hint}</p>}
    </div>
  );
}
