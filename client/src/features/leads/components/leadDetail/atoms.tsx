// Small presentational atoms for the Lead detail panel: InfoRow, SectionTitle
// and the InlineEditField. Extracted verbatim from LeadDetailPanel.tsx.
import React, { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-1.5 shrink-0">
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "text-[12px] text-foreground text-right break-words max-w-[58%]",
          mono && "font-mono text-[11px]"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <div className="icon-circle-lg border-2 border-border/25 text-muted-foreground flex items-center justify-center shrink-0">{icon}</div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

interface InlineEditFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  icon?: React.ReactNode;
  type?: "text" | "email" | "tel";
  testId?: string;
  selectOptions?: string[];
}

export function InlineEditField({
  label,
  value,
  onSave,
  icon,
  type = "text",
  testId,
  selectOptions,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent value changes
  useEffect(() => {
    if (!editing) setLocalValue(value);
  }, [value, editing]);

  const handleStartEdit = () => {
    setLocalValue(value);
    setEditing(true);
    setSaved(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (localValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(localValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setLocalValue(value); setEditing(false); }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0 group"
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>

      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
          {selectOptions ? (
            <select
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleSave}
              className="text-[12px] bg-background border border-border rounded px-1.5 py-0.5 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
              data-testid={`${testId}-select`}
              autoFocus
            >
              {selectOptions.map((opt) => (
                <option key={opt} value={opt}>{opt || "—"}</option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef}
              type={type}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="text-[12px] bg-background border border-border rounded px-1.5 py-0.5 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
              data-testid={`${testId}-input`}
              disabled={saving}
            />
          )}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0">
          {saved && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
          <span className="text-[12px] text-foreground text-right break-words max-w-[140px] truncate">
            {value || "—"}
          </span>
          <button
            type="button"
            onClick={handleStartEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 icon-circle-lg icon-circle-base hover:border-brand-indigo/40 hover:text-brand-indigo"
            aria-label={`Edit ${label}`}
            data-testid={`${testId}-edit-btn`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
