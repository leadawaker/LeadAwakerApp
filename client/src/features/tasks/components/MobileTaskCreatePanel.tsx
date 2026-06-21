import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Check } from "lucide-react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateTask, useTaskCategories } from "../api/tasksApi";
import { PRIORITY_OPTIONS, PRIORITY_COLORS, type TaskPriority } from "../types";
import { hapticSave } from "@/lib/haptics";

// ── Priority bars icon ────────────────────────────────────────────────────────
const PRIORITY_LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
function PriorityBars({ priority }: { priority: string }) {
  const level = PRIORITY_LEVEL[priority] ?? 2;
  const color = PRIORITY_COLORS[priority as TaskPriority] ?? PRIORITY_COLORS.medium;
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, flexShrink: 0 }} title={priority}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 2.5, height: 3 + i * 2.5, borderRadius: 1, background: i <= level ? color : "var(--line)", flexShrink: 0 }} />
      ))}
    </span>
  );
}

const PRIORITY_KEY: Record<string, string> = {
  low: "priority.low", medium: "priority.medium", high: "priority.high", urgent: "priority.urgent",
};

interface Props {
  onClose: () => void;
  onCreated: (id: number) => void;
}

export default function MobileTaskCreatePanel({ onClose, onCreated }: Props) {
  const { t } = useTranslation("tasks");
  const createMutation = useCreateTask();
  const { data: categories = [] } = useTaskCategories();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeName, setAssigneeName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);

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
        taskType: "admin",
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeName: assigneeName.trim() || null,
        categoryId,
        emoji: null,
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

  // ── Shared field styles (neumorphic inset) ───────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 12px", borderRadius: "var(--r-button)",
    background: "hsl(var(--background))", boxShadow: "var(--sh-inset-crisp)",
    border: "none", color: "var(--ink)", fontSize: 14, outline: "none",
  };
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider";

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      transition={{ type: "tween", duration: 0.28, ease: EASE_OUT }}
      style={{ height: "100dvh", background: "var(--bg)", willChange: "transform" }}
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

          {/* Priority */}
          <div className="space-y-1.5">
            <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.priority")}</label>
            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
                  data-testid="mobile-task-create-priority"
                >
                  <PriorityBars priority={priority} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t(PRIORITY_KEY[priority] ?? priority)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1 bg-white" side="bottom" align="start">
                {PRIORITY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setPriority(o.value); setPriorityOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] transition-colors",
                      priority === o.value ? "bg-muted font-medium" : "hover:bg-muted/50"
                    )}
                  >
                    <PriorityBars priority={o.value} />
                    <span>{t(PRIORITY_KEY[o.value] ?? o.label)}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
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

        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
