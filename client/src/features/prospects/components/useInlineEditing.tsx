import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export function useInlineEditing(onSave: (field: string, value: string) => Promise<void>) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const editRef = useRef<HTMLElement>(null);
  const editOriginal = useRef("");

  const startEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field);
    editOriginal.current = currentValue;
  }, []);

  const commitEdit = useCallback(async (field: string, el: HTMLElement) => {
    const value = el.innerText.trim();
    setEditingField(null);
    if (value !== editOriginal.current) {
      await onSave(field, value);
    }
  }, [onSave]);

  const cancelEdit = useCallback(() => {
    if (editRef.current) editRef.current.innerText = editOriginal.current;
    setEditingField(null);
  }, []);

  const editableField = useCallback((
    field: string,
    value: string,
    placeholder: string,
    className: string,
  ) => (
    <span
      ref={editingField === field ? editRef as React.RefObject<HTMLSpanElement> : undefined}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        className,
        "outline-none rounded px-1 -mx-1 transition-colors cursor-text",
        "focus:bg-white/80 dark:focus:bg-card/80 focus:ring-1 focus:ring-brand-blue/40",
        "hover:bg-black/[0.03]",
        !value && "text-muted-foreground/40 italic",
      )}
      onFocus={(e) => {
        startEdit(field, e.currentTarget.innerText.trim());
        if (!value) e.currentTarget.innerText = "";
      }}
      onBlur={(e) => commitEdit(field, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { cancelEdit(); e.currentTarget.blur(); }
      }}
    >
      {value || placeholder}
    </span>
  ), [editingField, startEdit, commitEdit, cancelEdit]);

  const editableMultiline = useCallback((
    field: string,
    value: string,
    placeholder: string,
    className: string,
  ) => (
    <div
      ref={editingField === field ? editRef as React.RefObject<HTMLDivElement> : undefined}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        className,
        "outline-none rounded-lg px-2.5 py-1 -mx-2.5 transition-colors cursor-text whitespace-pre-wrap",
        "focus:bg-white/80 dark:focus:bg-card/80 focus:ring-1 focus:ring-brand-blue/40",
        "hover:bg-black/[0.03]",
        !value && "text-muted-foreground/40 italic",
      )}
      onFocus={(e) => {
        startEdit(field, e.currentTarget.innerText.trim());
        if (!value) e.currentTarget.innerText = "";
      }}
      onBlur={(e) => commitEdit(field, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Escape") { cancelEdit(); e.currentTarget.blur(); }
      }}
    >
      {value || placeholder}
    </div>
  ), [editingField, startEdit, commitEdit, cancelEdit]);

  return { editingField, editRef, editableField, editableMultiline };
}
