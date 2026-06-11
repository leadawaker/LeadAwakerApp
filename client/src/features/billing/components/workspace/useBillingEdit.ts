import { useCallback, useState } from "react";

type Draft = Record<string, string>;

/**
 * Generic per-panel edit controller (port of accounts' useAccountEdit).
 * Tracks a sparse draft of changed fields; on save, sends only fields that
 * actually differ from the entity through onSave(id, patch).
 */
export function useBillingEdit<T extends { id: number; [key: string]: any }>(
  entity: T,
  onSave: (id: number, patch: Record<string, any>) => Promise<unknown>,
) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => { setDraft({}); setIsEditing(true); }, []);
  const cancelEdit = useCallback(() => { setDraft({}); setIsEditing(false); }, []);

  const set = useCallback((field: string, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const val = useCallback((field: string): string => {
    if (isEditing && field in draft) return draft[field];
    return String((entity as any)[field] ?? "");
  }, [isEditing, draft, entity]);

  const save = useCallback(async () => {
    const patch: Record<string, any> = {};
    for (const [field, value] of Object.entries(draft)) {
      const current = String((entity as any)[field] ?? "");
      if (value !== current) patch[field] = value;
    }
    if (Object.keys(patch).length === 0) { setIsEditing(false); return; }
    setSaving(true);
    try {
      await onSave(entity.id, patch);
      setDraft({});
      setIsEditing(false);
    } catch (e) {
      console.error("Billing section save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, entity, onSave]);

  return { isEditing, draft, saving, startEdit, cancelEdit, set, val, save };
}
