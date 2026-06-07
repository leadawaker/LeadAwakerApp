import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Check, Smile } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateTask, useTaskCategories, useTasks } from "../api/tasksApi";
import { PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";
import { hapticSave } from "@/lib/haptics";

const EMOJI_OPTIONS = [
  "📋", "📁", "📌", "⭐", "🎯", "🔥", "💡", "🚀",
  "📊", "🎨", "🔧", "📝", "💬", "📅", "🏷️", "✅",
  "🐛", "🔒", "📦", "🏠", "💰", "📞", "🎉", "⚡",
  "🌐", "🛠️", "📱", "🖥️", "👤", "🤝", "📈", "🔔",
];

const PRIORITY_KEY: Record<string, string> = {
  low: "priority.low", medium: "priority.medium", high: "priority.high", urgent: "priority.urgent",
};
const TYPE_KEY: Record<string, string> = {
  follow_up: "taskType.followUp", call: "taskType.call", review: "taskType.review", admin: "taskType.admin", custom: "taskType.custom",
};

interface Props {
  onClose: () => void;
  onCreated: (id: number) => void;
}

export default function MobileTaskCreatePanel({ onClose, onCreated }: Props) {
  const { t } = useTranslation("tasks");
  const createMutation = useCreateTask();
  const { data: categories = [] } = useTaskCategories();
  const { data: allTasks = [] } = useTasks();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [assigneeName, setAssigneeName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);
  const [emoji, setEmoji] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [estimateHours, setEstimateHours] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");

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
        parentTaskId,
        emoji: emoji || null,
        timeEstimate: (parseInt(estimateHours || "0") * 60 + parseInt(estimateMinutes || "0")) || null,
      });
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

  // ── Shared field styles (design tokens) ──────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 12px", borderRadius: "var(--r-surface)",
    background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)",
    fontSize: 14, outline: "none",
  };
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col animate-in slide-in-from-right duration-200 ease-out"
      style={{ height: "100dvh", background: "var(--bg)" }}
      data-testid="mobile-task-create-panel"
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 row"
        style={{
          gap: 10, background: "var(--bg)", borderBottom: "1px solid var(--line)",
          paddingTop: "max(env(safe-area-inset-top, 0px), 18px)",
          paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
        }}
      >
        <button
          onClick={onClose}
          style={{
            width: 38, height: 38, borderRadius: "var(--r-pill)", flexShrink: 0, border: "none", cursor: "pointer",
            background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label={t("detail.back", "Back")}
          data-testid="mobile-task-create-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="serif flex-1 truncate min-w-0" style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {t("create.title")}
        </h2>

        <button
          onClick={handleCreate}
          disabled={!canCreate}
          style={{
            height: 34, padding: "0 14px", borderRadius: "var(--r-pill)", border: "none", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
            cursor: canCreate ? "pointer" : "not-allowed",
            background: canCreate ? "var(--wine-grad)" : "var(--bg-2)",
            color: canCreate ? "var(--paper)" : "var(--mute-2)",
            boxShadow: canCreate ? "var(--sh-raised-crisp)" : "none",
          }}
          data-testid="mobile-task-create-submit"
        >
          <Check className="h-3.5 w-3.5" />
          {createMutation.isPending ? t("create.creating") : t("create.create")}
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
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("create.taskTitle")} *</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("create.taskTitle")} autoFocus data-testid="mobile-task-create-title" />
          </div>

          {/* Emoji picker */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.emoji")}</label>
            <div className="flex items-center gap-2">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button type="button" style={{ ...inputStyle, width: "auto", display: "flex", alignItems: "center", gap: 8, color: emoji ? "var(--ink)" : "var(--mute)" }} data-testid="mobile-task-create-emoji-trigger">
                    {emoji ? <span className="text-xl">{emoji}</span> : <Smile className="h-5 w-5" />}
                    <span>{emoji ? t("fields.changeEmoji") : t("fields.pickEmoji")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2 bg-white" side="bottom" align="start">
                  <div className="grid grid-cols-8 gap-1" data-testid="mobile-task-emoji-grid">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                        className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center text-xl hover:bg-foreground/[0.06] transition-colors",
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
                <button type="button" onClick={() => setEmoji("")} className="h-10 px-2 rounded-xl text-[13px] active:scale-95" style={{ color: "var(--mute)" }} data-testid="mobile-task-create-emoji-clear">
                  {t("fields.clearEmoji")}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.description")}</label>
            <textarea
              style={{ ...inputStyle, height: "auto", minHeight: 80, padding: "10px 12px", resize: "none" }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("fields.descriptionPlaceholder")}
              data-testid="mobile-task-create-description"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.dueDate")}</label>
            <input type="datetime-local" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="mobile-task-create-due-date" />
          </div>

          {/* Time estimate */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.timeEstimate")}</label>
            <div className="flex gap-2 items-center">
              <input type="number" min="0" style={{ ...inputStyle, width: 80 }} value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" data-testid="mobile-task-create-estimate-hours" />
              <span className="text-[13px]" style={{ color: "var(--mute)" }}>{t("fields.hours")}</span>
              <input type="number" min="0" max="59" style={{ ...inputStyle, width: 80 }} value={estimateMinutes}
                onChange={(e) => setEstimateMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" data-testid="mobile-task-create-estimate-minutes" />
              <span className="text-[13px]" style={{ color: "var(--mute)" }}>{t("fields.minutes")}</span>
            </div>
          </div>

          {/* Priority + Type */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.priority")}</label>
              <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="mobile-task-create-priority">
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(PRIORITY_KEY[o.value] ?? o.label)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.type")}</label>
              <select style={inputStyle} value={taskType} onChange={(e) => setTaskType(e.target.value)} data-testid="mobile-task-create-type">
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(TYPE_KEY[o.value] ?? o.label)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.category")}</label>
            <select style={inputStyle} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)} data-testid="mobile-task-create-category">
              <option value="">{t("fields.noCategory", "No Category")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.assignee")}</label>
            <input style={inputStyle} value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder={t("fields.assigneePlaceholder")} data-testid="mobile-task-create-assignee" />
          </div>

          {/* Associated lead */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.lead")}</label>
            <input style={inputStyle} value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={t("fields.optional")} data-testid="mobile-task-create-lead" />
          </div>

          {/* Parent task */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.parentTask")}</label>
            <select style={inputStyle} value={parentTaskId ?? ""} onChange={(e) => setParentTaskId(e.target.value ? Number(e.target.value) : null)} data-testid="mobile-task-create-parent">
              <option value="">{t("fields.noParent")}</option>
              {(allTasks as any[]).map((tk: any) => (
                <option key={tk.id} value={tk.id}>{tk.title}</option>
              ))}
            </select>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  );
}
