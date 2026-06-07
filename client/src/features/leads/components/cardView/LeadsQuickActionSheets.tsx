// Mobile quick-action bottom sheets (status / note / delete) — Feature #41.
// Extracted from LeadsCardViewMain.tsx. Rendered through a portal on document.body.
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_HEX, STATUS_COLORS, ALL_LEAD_FILTER_STAGES } from "./constants";
import { getFullName } from "./leadUtils";

type QuickActionType = "status" | "note" | "delete" | null;

export function LeadsQuickActionSheets({
  quickActionType,
  quickActionLead,
  quickNoteText,
  quickStatusPending,
  quickActionBusy,
  deleteLabel,
  setQuickNoteText,
  setQuickStatusPending,
  closeQuickAction,
  handleQuickSaveStatus,
  handleQuickSaveNote,
  handleQuickConfirmDelete,
}: {
  quickActionType: QuickActionType;
  quickActionLead: Record<string, any> | null;
  quickNoteText: string;
  quickStatusPending: string;
  quickActionBusy: boolean;
  deleteLabel: string;
  setQuickNoteText: (v: string) => void;
  setQuickStatusPending: (v: string) => void;
  closeQuickAction: () => void;
  handleQuickSaveStatus: () => void;
  handleQuickSaveNote: () => void;
  handleQuickConfirmDelete: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      {quickActionType && quickActionLead && (
        <>
          {/* Backdrop */}
          <motion.div
            key="quick-action-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[400] bg-black/50 md:hidden"
            onClick={closeQuickAction}
          />
          {/* Sheet */}
          <motion.div
            key="quick-action-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
            className="fixed inset-x-0 bottom-0 z-[401] bg-background rounded-t-3xl border-t border-border/30 md:hidden"
            style={{ paddingBottom: "calc(1rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* ── Status Picker ── */}
            {quickActionType === "status" && (
              <div className="px-5 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-semibold">Change Status</h2>
                  <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[50dvh] overflow-y-auto pb-2">
                  {ALL_LEAD_FILTER_STAGES.map((stage) => {
                    const colors = STATUS_COLORS[stage];
                    const active = quickStatusPending === stage;
                    return (
                      <button
                        key={stage}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-2xl border text-[15px] min-h-[52px] transition-colors",
                          active
                            ? (colors?.badge ?? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/40")
                            : "border-border/40 text-foreground"
                        )}
                        onClick={() => setQuickStatusPending(stage)}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[stage] || "#9ca3af" }} />
                          {stage}
                        </span>
                        {active && <Check className="h-5 w-5 text-brand-indigo shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-3">
                  <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                  <button
                    onClick={handleQuickSaveStatus}
                    disabled={quickActionBusy}
                    className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                    data-testid="quick-status-save"
                  >
                    {quickActionBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Add Note ── */}
            {quickActionType === "note" && (
              <div className="px-5 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-semibold">Add Note</h2>
                  <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                </div>
                <textarea
                  autoFocus
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Note about this lead…"
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-muted/30 text-[15px] placeholder:text-muted-foreground/50 outline-none focus:border-brand-indigo/50 resize-none"
                  data-testid="quick-note-input"
                />
                <div className="flex gap-3 pt-3">
                  <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                  <button
                    onClick={handleQuickSaveNote}
                    disabled={quickActionBusy || !quickNoteText.trim()}
                    className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                    data-testid="quick-note-save"
                  >
                    {quickActionBusy ? "Saving…" : "Save Note"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Delete Confirm ── */}
            {quickActionType === "delete" && (
              <div className="px-5 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[17px] font-semibold text-red-600">Delete Lead?</h2>
                  <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                </div>
                <p className="text-[14px] text-muted-foreground mb-5">
                  Are you sure you want to delete <strong>{getFullName(quickActionLead)}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                  <button
                    onClick={handleQuickConfirmDelete}
                    disabled={quickActionBusy}
                    className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-[15px] font-semibold disabled:opacity-60"
                    data-testid="quick-delete-confirm"
                  >
                    {quickActionBusy ? "…" : deleteLabel}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
