import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check, Smile } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateTask, useTaskCategories, useTasks } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";

// ── i18n key maps for select options (module-level, safe for constants) ────────
const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

const PRIORITY_I18N_KEY: Record<string, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

const TYPE_I18N_KEY: Record<string, string> = {
  follow_up: "taskType.followUp",
  call: "taskType.call",
  review: "taskType.review",
  admin: "taskType.admin",
  custom: "taskType.custom",
};

// ── Expand-on-hover button classes (§28) ──────────────────────────────────────
const EMOJI_OPTIONS = [
  "📋", "📁", "📌", "⭐", "🎯", "🔥", "💡", "🚀",
  "📊", "🎨", "🔧", "📝", "💬", "📅", "🏷️", "✅",
  "🐛", "🔒", "📦", "🏠", "💰", "📞", "🎉", "⚡",
  "🌐", "🛠️", "📱", "🖥️", "👤", "🤝", "📈", "🔔",
];

const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Props ──────────────────────────────────────────────────────────────────────

interface TaskCreatePanelProps {
  onClose: () => void;
  onCreated: (id: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaskCreatePanel({ onClose, onCreated }: TaskCreatePanelProps) {
  const { t } = useTranslation("tasks");
  const createMutation = useCreateTask();
  const { data: categories = [] } = useTaskCategories();
  const { data: allTasks = [] } = useTasks();

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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);
  const [emoji, setEmoji] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

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
        categoryId,
        parentTaskId,
        emoji: emoji || null,
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
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("create.title")}</span>
            <div className="flex-1 min-w-0" />
            {/* Create */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={cn(xBase, "hover:max-w-[100px]", canCreate ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/30 cursor-not-allowed")}
              title={t("create.create")}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{createMutation.isPending ? t("create.creating") : t("create.create")}</span>
            </button>
            {/* Close */}
            <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
          </div>

          {/* Title — large, editable */}
          <input
            className="w-full text-xl font-semibold font-heading text-foreground bg-transparent outline-none placeholder:text-foreground/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("create.taskTitle")}
            autoFocus
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="relative flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-4">

          {/* Emoji picker */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.emoji")}</label>
            <div className="flex items-center gap-2">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-9 px-3 rounded-lg border border-border/30 text-[13px] flex items-center gap-2 transition-colors hover:border-brand-indigo/50",
                      emoji ? "bg-white/60 dark:bg-white/[0.10]" : "bg-white/60 dark:bg-white/[0.10] text-muted-foreground"
                    )}
                    data-testid="task-create-emoji-trigger"
                  >
                    {emoji ? <span className="text-lg">{emoji}</span> : <Smile className="h-4 w-4" />}
                    <span>{emoji ? t("fields.changeEmoji") : t("fields.pickEmoji")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" side="bottom" align="start">
                  <div className="grid grid-cols-8 gap-1" data-testid="task-emoji-grid">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                        className={cn(
                          "h-8 w-8 rounded-md flex items-center justify-center text-lg hover:bg-foreground/[0.06] transition-colors",
                          emoji === e && "bg-brand-indigo/10 ring-1 ring-brand-indigo/30"
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {emoji && (
                <button
                  type="button"
                  onClick={() => setEmoji("")}
                  className="h-9 px-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="task-create-emoji-clear"
                >
                  {t("fields.clearEmoji")}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.description")}</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("fields.descriptionPlaceholder")}
            />
          </div>

          {/* Account name */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.account")} *</label>
            <input
              className={inputCls}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={t("fields.accountPlaceholder")}
            />
          </div>

          {/* Campaign + Lead — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.campaign")}</label>
              <input
                className={inputCls}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={t("fields.optional")}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.lead")}</label>
              <input
                className={inputCls}
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder={t("fields.optional")}
              />
            </div>
          </div>

          {/* Status + Priority — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.status")}</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(STATUS_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.priority")}</label>
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(PRIORITY_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + Due Date — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.type")}</label>
              <select className={selectCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(TYPE_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.dueDate")}</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Category + Assignee — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.category")}</label>
              <select
                className={selectCls}
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                data-testid="task-create-category"
              >
                <option value="">{t("categories.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.assignee")}</label>
              <input
                className={inputCls}
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder={t("fields.assigneePlaceholder")}
              />
            </div>
          </div>

          {/* Parent task */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.parentTask")}</label>
            <select
              className={selectCls}
              value={parentTaskId ?? ""}
              onChange={(e) => setParentTaskId(e.target.value ? Number(e.target.value) : null)}
              data-testid="task-create-parent"
            >
              <option value="">{t("fields.noParent")}</option>
              {(allTasks as any[]).map((tk: any) => (
                <option key={tk.id} value={tk.id}>{tk.title}</option>
              ))}
            </select>
          </div>

        </div>
      </div>
    </div>
  );
}
