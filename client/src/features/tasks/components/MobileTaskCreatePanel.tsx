import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateTask, useTaskCategories } from "../api/tasksApi";
import { PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";
import { hapticSave } from "@/lib/haptics";

// ── i18n label maps (standalone — no module-level hooks) ─────────────────────
const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow Up",
  call: "Call",
  review: "Review",
  admin: "Admin",
  custom: "Custom",
};

interface Props {
  onClose: () => void;
  onCreated: (id: number) => void;
}

export default function MobileTaskCreatePanel({ onClose, onCreated }: Props) {
  const createMutation = useCreateTask();
  const { data: categories = [] } = useTaskCategories();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [assigneeName, setAssigneeName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const canCreate = title.trim().length > 0 && !createMutation.isPending;

  // ── Handler ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!canCreate) return;
    hapticSave();
    const accountsId = parseInt(
      localStorage.getItem("leadawaker_current_account_id") ?? "1",
      10,
    );
    try {
      const res = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        accountsId,
        accountName: "",
        campaignName: null,
        leadName: leadName.trim() || null,
        status: "todo",
        priority,
        taskType,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeName: assigneeName.trim() || null,
        categoryId,
      });
      // Extract new task ID from response
      try {
        const body = await res.json();
        if (body?.id) {
          onCreated(body.id);
          return;
        }
      } catch {
        // response already consumed or empty
      }
      onClose();
    } catch {
      // mutation error handled by TanStack Query
    }
  };

  // ── Shared field styles ──────────────────────────────────────────────────────
  const inputCls =
    "w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/30 text-[14px] outline-none focus:border-brand-indigo/50 transition-colors";
  const selectCls = inputCls;
  const labelCls =
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background animate-in slide-in-from-right duration-250 ease-out"
      style={{ height: "100dvh" }}
      data-testid="mobile-task-create-panel"
    >
      {/* ── Sticky header: back + title + create ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 border-b border-border/20 bg-background/95 backdrop-blur-sm"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          paddingBottom: "12px",
        }}
      >
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full border border-border/50 bg-card grid place-items-center shrink-0 active:scale-95 transition-transform"
          aria-label="Cancel task creation"
          data-testid="mobile-task-create-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="flex-1 text-[17px] font-semibold font-heading truncate min-w-0">
          New Task
        </h2>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className={cn(
            "h-8 px-3 rounded-full text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors",
            canCreate
              ? "bg-brand-indigo text-white active:scale-95"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          data-testid="mobile-task-create-submit"
        >
          <Check className="h-3.5 w-3.5" />
          {createMutation.isPending ? "Creating…" : "Create"}
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}
      >
        <div className="px-4 py-5 flex flex-col gap-5">

          {/* Title */}
          <div className="space-y-1.5">
            <label className={labelCls}>Title *</label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              data-testid="mobile-task-create-title"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>Description</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30 text-[14px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description…"
              data-testid="mobile-task-create-description"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className={labelCls}>Due Date</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="mobile-task-create-due-date"
            />
          </div>

          {/* Priority + Type — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Priority</label>
              <select
                className={selectCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                data-testid="mobile-task-create-priority"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {PRIORITY_LABELS[o.value] ?? o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Type</label>
              <select
                className={selectCls}
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                data-testid="mobile-task-create-type"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {TYPE_LABELS[o.value] ?? o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className={labelCls}>Category</label>
            <select
              className={selectCls}
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              data-testid="mobile-task-create-category"
            >
              <option value="">No Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className={labelCls}>Assignee</label>
            <input
              className={inputCls}
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Assignee name (optional)"
              data-testid="mobile-task-create-assignee"
            />
          </div>

          {/* Associated lead */}
          <div className="space-y-1.5">
            <label className={labelCls}>Associated Lead</label>
            <input
              className={inputCls}
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Lead name (optional)"
              data-testid="mobile-task-create-lead"
            />
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}
