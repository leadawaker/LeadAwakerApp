// Editable notes state for LeadDetailPanel: local buffer, dirty/saved flags,
// and the PATCH save handler. The original-notes ref is also consumed by
// useVoiceRecording (transcription append).
// Extracted verbatim from LeadDetailPanel.tsx (Session C).
import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/apiUtils";

export function useLeadNotes(
  leadId: number | string | undefined,
  lead: Record<string, any> | null,
) {
  // ── Notes editing state ──
  const [localNotes, setLocalNotes] = useState<string>("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesOriginalRef = useRef<string>("");

  // Sync notes when lead changes
  useEffect(() => {
    const notes = lead?.notes || "";
    notesOriginalRef.current = notes;
    setLocalNotes(notes);
    setNotesDirty(false);
    setNotesSaved(false);
  }, [lead?.Id, lead?.id, lead?.notes]);

  const handleNotesSave = async () => {
    if (!leadId || !notesDirty || savingNotes) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: localNotes }),
      });
      if (res.ok) {
        notesOriginalRef.current = localNotes;
        setNotesDirty(false);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setSavingNotes(false);
    }
  };

  return {
    localNotes,
    setLocalNotes,
    notesDirty,
    setNotesDirty,
    savingNotes,
    notesSaved,
    setNotesSaved,
    notesOriginalRef,
    handleNotesSave,
  };
}
