import { useState } from "react";
import { X, Check } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";
import { useCreateTask } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";

// ── Expand-on-hover button classes (§28) ──────────────────────────────────────
const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Props ──────────────────────────────────────────────────────────────────────

interface TaskCreatePanelProps {
  onClose: () => void;
  onCreated: (id: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaskCreatePanel({ onClose, onCreated }: TaskCreatePanelProps) {
  const createMutation = useCreateTask();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accountName, setAccountName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [dueDate, setDueDate] = useState("");
  const [assigneeName, setAssigneeName] = useState("");

  // ── Handler ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!title.trim() || !accountName.trim()) return;
    try {
      const res = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        accountsId: 0, // will be resolved server-side or overridden
        accountName: accountName.trim(),
        campaignName: campaignName.trim() || null,
        leadName: leadName.trim() || null,
        status,
        priority,
        taskType,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeName: assigneeName.trim() || null,
      });
      // apiRequest returns a Response — try to extract the new task ID
      try {
        const body = await res.json();
        if (body?.id) {
          onCreated(body.id);
          return;
        }
      } catch {
        // response may already be consumed or empty
      }
      onClose();
    } catch {
      // mutation error is handled by TanStack Query
    }
  };

  const canCreate = title.trim() && accountName.trim() && !createMutation.isPending;

  // ── Shared field styles ─────────────────────────────────────────────────────
  const inputCls = "w-full h-9 px-3 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] outline-none focus:border-brand-indigo/50 transition-colors";
  const selectCls = inputCls;
  const labelCls = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="task-create-panel">

      {/* Warm gradient background */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_180%_123%_at_78%_83%,rgba(219,234,254,0.7)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,rgba(224,231,255,0.6)_5%,transparent_30%)] dark:opacity-[0.08]" />

      {/* ── Header ── */}
      <div className="relative shrink-0">
        <div className="px-4 pt-6 pb-4 space-y-3">
          {/* Toolbar row */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">New Task</span>
            <div className="flex-1 min-w-0" />
            {/* Create */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={cn(xBase, "hover:max-w-[100px]", canCreate ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/30 cursor-not-allowed")}
              title="Create"
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{createMutation.isPending ? "Creating…" : "Create"}</span>
            </button>
            {/* Close */}
            <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
          </div>

          {/* Title — large, editable */}
          <input
            className="w-full text-xl font-semibold font-heading text-foreground bg-transparent outline-none placeholder:text-foreground/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="relative flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-4">

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>Description</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
            />
          </div>

          {/* Account name */}
          <div className="space-y-1.5">
            <label className={labelCls}>Account *</label>
            <input
              className={inputCls}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name"
            />
          </div>

          {/* Campaign + Lead — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Campaign</label>
              <input
                className={inputCls}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Lead</label>
              <input
                className={inputCls}
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Status + Priority — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Status</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Priority</label>
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + Due Date — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Type</label>
              <select className={selectCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Due Date</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className={labelCls}>Assignee</label>
            <input
              className={inputCls}
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Assignee name"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
