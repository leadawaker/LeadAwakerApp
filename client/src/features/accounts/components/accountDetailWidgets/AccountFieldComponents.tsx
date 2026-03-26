import { useState, useCallback } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Field display components ───────────────────────────────────────────────────

/** Label above value, with a subtle divider below. Value is below the label. */
export function InfoRow({ label, value, editChild }: {
  label: string;
  value?: React.ReactNode;
  editChild?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block leading-none mb-1">
        {label}
      </span>
      <div className="min-h-[1.125rem]">
        {editChild ?? (
          <span className="text-[12px] font-semibold text-foreground leading-snug">
            {value ?? <span className="text-foreground/25 font-normal italic">{"2014"}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** Sub-section header within a widget column */
export function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5 pt-3 mt-1 mb-1 border-t border-white/30">
      {Icon && <Icon className="w-3 h-3 text-foreground/40" />}
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</span>
    </div>
  );
}

// ── Edit input helpers ─────────────────────────────────────────────────────────

export function EditText({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25"
    />
  );
}

export function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-blue/30 rounded-lg px-2.5 py-1 resize-none outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/25 leading-relaxed"
    />
  );
}

// ── Twilio display helpers (read-only mode) ────────────────────────────────────

export function MonoValue({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">{"2014"}</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className="text-[11px] font-mono text-foreground truncate">{value}</span>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

export function SecretDisplay({ value }: { value?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  if (!value) return <span className="text-foreground/25 font-normal italic text-[12px]">{"2014"}</span>;
  return (
    <span className="flex items-center gap-0.5 min-w-0">
      <span className={cn("text-[11px] font-mono text-foreground truncate", !revealed && "tracking-widest")}>
        {revealed ? value : "••••••••••••"}
      </span>
      <button onClick={() => setRevealed((r) => !r)} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
      <button onClick={copy} className="p-0.5 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0">
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
