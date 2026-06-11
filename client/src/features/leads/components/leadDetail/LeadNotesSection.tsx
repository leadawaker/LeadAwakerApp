// Notes section (editable textarea, voice-memo recording, save indicators,
// demo-campaign context block) for the Lead detail panel. JSX moved verbatim
// from LeadDetailPanel.tsx; props match the original locals (structural split).
import React from "react";
import { useTranslation } from "react-i18next";
import { StickyNote, Loader2, Square, Mic, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface LeadNotesSectionProps {
  transcribing: boolean;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  startVoiceRecording: () => void;
  stopVoiceRecording: () => void;
  savingNotes: boolean;
  notesSaved: boolean;
  notesDirty: boolean;
  handleNotesSave: () => void;
  localNotes: string;
  setLocalNotes: React.Dispatch<React.SetStateAction<string>>;
  setNotesDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setNotesSaved: React.Dispatch<React.SetStateAction<boolean>>;
  notesOriginalRef: React.MutableRefObject<string>;
  demoNicheCtx: Record<string, any> | null;
}

export function LeadNotesSection({
  transcribing,
  isRecordingVoice,
  recordingSeconds,
  startVoiceRecording,
  stopVoiceRecording,
  savingNotes,
  notesSaved,
  notesDirty,
  handleNotesSave,
  localNotes,
  setLocalNotes,
  setNotesDirty,
  setNotesSaved,
  notesOriginalRef,
  demoNicheCtx,
}: LeadNotesSectionProps) {
  const { t } = useTranslation("leads");
  return (
          <div data-testid="lead-notes-section">
            <div className="flex items-center justify-between mb-2 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground"><StickyNote className="h-3.5 w-3.5" /></span>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("detail.sections.notes")}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Voice memo recording button */}
                {transcribing ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-indigo">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("notes.transcribing")}
                  </div>
                ) : isRecordingVoice ? (
                  <button
                    onClick={stopVoiceRecording}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-500/15 text-red-600 text-[12px] font-medium border border-red-300/60 hover:bg-red-500/25 transition-colors"
                    title={t("notes.stopRecording")}
                  >
                    <Square className="h-3 w-3 fill-current" />
                    {recordingSeconds}s
                  </button>
                ) : (
                  <button
                    onClick={startVoiceRecording}
                    disabled={savingNotes || transcribing}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
                    title={t("notes.recordVoiceMemo")}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                {/* Save indicators */}
                {savingNotes && (
                  <Loader2
                    className="h-3 w-3 animate-spin text-muted-foreground"
                    data-testid="notes-saving-indicator"
                  />
                )}
                {notesSaved && !savingNotes && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400" data-testid="notes-saved-indicator">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("notes.saved")}
                  </span>
                )}
                {notesDirty && !savingNotes && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNotesSave}
                    className="h-6 px-2 text-[11px] gap-1"
                    data-testid="notes-save-button"
                    aria-label={t("notes.saveNotes")}
                  >
                    <Save className="h-3 w-3" />
                    {t("notes.save")}
                  </Button>
                )}
              </div>
            </div>
            {demoNicheCtx && (
              <div className="mb-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11px] space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-violet-500/70 mb-1.5">Demo Campaign</div>
                {demoNicheCtx.company_name && <div><span className="text-muted-foreground">Company:</span> <span className="text-foreground/80">{demoNicheCtx.company_name}</span></div>}
                {(demoNicheCtx.niche_label || demoNicheCtx.raw) && <div><span className="text-muted-foreground">Niche:</span> <span className="text-foreground/80">{demoNicheCtx.niche_label || demoNicheCtx.raw}</span></div>}
                {demoNicheCtx.service_name && <div><span className="text-muted-foreground">Service:</span> <span className="text-foreground/80">{demoNicheCtx.service_name}</span></div>}
                {demoNicheCtx.usp && <div><span className="text-muted-foreground">USP:</span> <span className="text-foreground/80">{demoNicheCtx.usp}</span></div>}
                {demoNicheCtx.what_lead_did && <div><span className="text-muted-foreground">Lead did:</span> <span className="text-foreground/80">{demoNicheCtx.what_lead_did}</span></div>}
                {demoNicheCtx.niche_question && <div><span className="text-muted-foreground">Question:</span> <span className="text-foreground/80 italic">{demoNicheCtx.niche_question}</span></div>}
              </div>
            )}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-2">
              <Textarea
                value={localNotes}
                onChange={(e) => {
                  setLocalNotes(e.target.value);
                  setNotesDirty(e.target.value !== notesOriginalRef.current);
                  setNotesSaved(false);
                }}
                onBlur={handleNotesSave}
                placeholder={t("notes.placeholder")}
                className="min-h-[80px] resize-none text-[12px] bg-transparent border-0 shadow-none focus-visible:ring-0 p-1 leading-relaxed"
                data-testid="lead-notes-textarea"
                disabled={savingNotes || transcribing}
              />
            </div>

          </div>
  );
}
