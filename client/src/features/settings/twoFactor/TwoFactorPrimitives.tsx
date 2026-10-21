import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full neu-inset-crisp px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/20";
export const inputStyle = { borderRadius: "var(--r-button)" } as const;

export function CodeInput({
  value, onChange, placeholder, testId, autoFocus, maxLength = 11,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; testId: string; autoFocus?: boolean; maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="text"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={maxLength}
      placeholder={placeholder}
      className={cn(inputClass, "tracking-[0.25em] text-center font-semibold")}
      style={inputStyle}
      data-testid={testId}
    />
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
      {children}
    </div>
  );
}

/** One method row: title + description on the left, actions on the right. */
export function MethodRow({
  title, description, status, actions, children, testId,
}: {
  title: ReactNode; description?: ReactNode; status?: ReactNode; actions?: ReactNode; children?: ReactNode; testId?: string;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0 space-y-3" data-testid={testId}>
      <div className="flex items-center gap-3 min-h-11">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {status}
          </div>
          {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function PanelBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-4 space-y-3">{children}</div>;
}
