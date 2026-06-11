import { useCallback, useState } from "react";
import type { AccountRow } from "./types";

type Draft = Record<string, string>;

/**
 * Per-section edit controller. Tracks a sparse draft of changed fields; on save,
 * loops only the fields that actually differ from the account through onSave.
 * Instantiate one per editable panel (Details, Twilio card, Instagram card, …).
 */
export function useAccountEdit(account: AccountRow, onSave: (field: string, value: string) => Promise<void>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => {
    setDraft({});
    setIsEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setDraft({});
    setIsEditing(false);
  }, []);

  const set = useCallback((field: string, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  }, []);

  const val = useCallback(
    (field: string): string => {
      if (isEditing && field in draft) return draft[field];
      return String((account as any)[field] ?? "");
    },
    [isEditing, draft, account],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(draft)) {
        const current = String((account as any)[field] ?? "");
        if (value !== current) await onSave(field, value);
      }
      setDraft({});
      setIsEditing(false);
    } catch (e) {
      console.error("Account section save failed", e);
    } finally {
      setSaving(false);
    }
  }, [draft, account, onSave]);

  return { isEditing, draft, saving, startEdit, cancelEdit, set, val, save };
}
