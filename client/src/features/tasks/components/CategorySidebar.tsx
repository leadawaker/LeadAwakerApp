import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  FolderOpen,
  GanttChart,
  Layers,
  Plus,
  Table2,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import type { ViewMode } from "../types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useTaskCategories, useCreateTaskCategory, useUpdateTaskCategory, useDeleteTaskCategory } from "../api/tasksApi";
import type { TaskCategory } from "@shared/schema";

/* ── Emoji & color presets ── */
const EMOJI_OPTIONS = [
  "📋", "📁", "📌", "⭐", "🎯", "🔥", "💡", "🚀",
  "📊", "🎨", "🔧", "📝", "💬", "📅", "🏷️", "✅",
  "🐛", "🔒", "📦", "🏠", "💰", "📞", "🎉", "⚡",
  "🌐", "🛠️", "📱", "🖥️", "👤", "🤝", "📈", "🔔",
];

const COLOR_PRESETS = [
  "#4F46E5", "#7C3AED", "#EC4899", "#EF4444",
  "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6",
  "#A855F7", "#D946EF", "#F43F5E", "#64748B",
];

interface CategorySidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  /** All tasks (unfiltered) — used for count badges */
  tasks?: Array<{ id: number; categoryId?: number | null }>;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}

const VIEW_TABS: { key: ViewMode; icon: typeof Columns3; tKey: string }[] = [
  { key: "kanban", icon: Columns3, tKey: "views.kanban" },
  { key: "table", icon: Table2, tKey: "views.table" },
  { key: "gantt", icon: GanttChart, tKey: "views.gantt" },
];

export default function CategorySidebar({
  collapsed,
  onCollapse,
  selectedCategoryId,
  onSelectCategory,
  tasks = [],
  viewMode,
  onViewModeChange,
}: CategorySidebarProps) {
  const { t } = useTranslation("tasks");
  const { data: categories = [] } = useTaskCategories();
  const createMutation = useCreateTaskCategory();
  const updateMutation = useUpdateTaskCategory();
  const deleteMutation = useDeleteTaskCategory();

  // Count tasks per category for badges
  const totalCount = tasks.length;
  const countByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of tasks) {
      if (t.categoryId) {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newColor, setNewColor] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);
  const deletePendingCategory = useMemo(
    () => categories.find((c) => c.id === deletePendingId) ?? null,
    [categories, deletePendingId]
  );
  const deletePendingTaskCount = useMemo(
    () => (deletePendingId ? countByCategory.get(deletePendingId) ?? 0 : 0),
    [deletePendingId, countByCategory]
  );

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editEmojiPickerOpen, setEditEmojiPickerOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setNewName("");
    setNewIcon("");
    setNewColor("");
    setAddingNew(false);
    setEmojiPickerOpen(false);
  }, []);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name || createMutation.isPending) return;
    try {
      await createMutation.mutateAsync({
        name,
        ...(newIcon ? { icon: newIcon } : {}),
        ...(newColor ? { color: newColor } : {}),
      });
      resetForm();
    } catch { /* handled by TanStack */ }
  }, [newName, newIcon, newColor, createMutation, resetForm]);

  const handleDeleteRequest = useCallback((id: number) => {
    setDeletePendingId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletePendingId || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deletePendingId);
      if (selectedCategoryId === deletePendingId) onSelectCategory(null);
    } catch { /* handled by TanStack */ }
    setDeletePendingId(null);
  }, [deletePendingId, deleteMutation, selectedCategoryId, onSelectCategory]);

  const startEditing = useCallback((cat: TaskCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon ?? "");
    setEditColor(cat.color ?? "");
    setEditEmojiPickerOpen(false);
    // Close create form if open
    if (addingNew) resetForm();
    // Focus input after render
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, [addingNew, resetForm]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditIcon("");
    setEditColor("");
    setEditEmojiPickerOpen(false);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editingId || !editName.trim() || updateMutation.isPending) return;
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        data: {
          name: editName.trim(),
          icon: editIcon || null,
          color: editColor || null,
        },
      });
      cancelEditing();
    } catch { /* handled by TanStack */ }
  }, [editingId, editName, editIcon, editColor, updateMutation, cancelEditing]);

  const renderEditForm = (cat: TaskCategory) => (
    <div key={cat.id} className="flex flex-col gap-2 px-0.5 py-1" data-testid={`category-edit-form-${cat.id}`}>
      {/* Row 1: Emoji button + Name input + confirm/cancel */}
      <div className="flex items-center gap-1.5">
        <Popover open={editEmojiPickerOpen} onOpenChange={setEditEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border transition-colors",
                editIcon
                  ? "border-brand-indigo/30 bg-brand-indigo/5"
                  : "border-border/50 bg-muted hover:bg-card"
              )}
              title={t("categories.pickIcon")}
              data-testid="category-edit-emoji-trigger"
            >
              {editIcon ? (
                <span className="text-sm">{editIcon}</span>
              ) : (
                <span className="text-xs text-muted-foreground">😀</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-[220px] p-2"
            data-testid="category-edit-emoji-picker"
          >
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 px-0.5">
              {t("categories.pickIcon")}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setEditIcon(editIcon === emoji ? "" : emoji);
                    setEditEmojiPickerOpen(false);
                    editInputRef.current?.focus();
                  }}
                  className={cn(
                    "h-7 w-7 rounded flex items-center justify-center text-sm hover:bg-card transition-colors",
                    editIcon === emoji && "bg-highlight-active ring-1 ring-brand-indigo/30"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {editIcon && (
              <button
                type="button"
                onClick={() => { setEditIcon(""); setEditEmojiPickerOpen(false); }}
                className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-0.5"
              >
                {t("categories.clearIcon")}
              </button>
            )}
          </PopoverContent>
        </Popover>

        <input
          ref={editInputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUpdate();
            if (e.key === "Escape") cancelEditing();
          }}
          placeholder={t("categories.newPlaceholder")}
          className="flex-1 min-w-0 h-8 px-2 text-[13px] rounded-lg bg-muted border border-border/50 focus:border-brand-indigo focus:outline-none transition-colors"
          data-testid="category-edit-input"
        />
        <button
          onClick={handleUpdate}
          disabled={!editName.trim() || updateMutation.isPending}
          className="h-7 w-7 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancelEditing}
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Row 2: Color picker swatches */}
      <div className="px-0.5">
        <p className="text-[11px] font-medium text-muted-foreground mb-1">
          {t("categories.pickColor")}
        </p>
        <div className="flex flex-wrap gap-1">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setEditColor(editColor === color ? "" : color)}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-all",
                editColor === color
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-foreground/30 hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              title={color}
              data-testid={`category-edit-color-${color.slice(1)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderCategoryItem = (cat: TaskCategory) => {
    // If editing this category, show edit form instead
    if (editingId === cat.id && !collapsed) {
      return renderEditForm(cat);
    }

    const isSelected = selectedCategoryId === cat.id;
    const colorDot = cat.color ? (
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: cat.color }}
      />
    ) : null;

    return (
      <Tooltip key={cat.id}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelectCategory(isSelected ? null : cat.id)}
            className={cn(
              "group relative flex items-center rounded-full transition-colors w-full",
              collapsed
                ? "h-[40px] w-[40px] justify-center mx-auto"
                : "h-[40px] pl-[6px] pr-2 gap-2",
              isSelected
                ? "bg-highlight-active text-foreground font-semibold"
                : "text-foreground/70 hover:bg-card hover:text-foreground"
            )}
            data-testid={`category-item-${cat.id}`}
          >
            {/* Icon / color dot */}
            <div className="relative h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-black/[0.08] dark:border-white/[0.08]">
              {cat.icon ? (
                <span className="text-sm">{cat.icon}</span>
              ) : colorDot ? (
                colorDot
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
            </div>
            {!collapsed && (
              <>
                <span className="text-[13px] font-medium truncate flex-1 text-left">
                  {cat.name}
                </span>
                {/* Count badge */}
                {(countByCategory.get(cat.id) ?? 0) > 0 && (
                  <span className="text-[11px] tabular-nums text-muted-foreground font-medium shrink-0 group-hover:hidden">
                    {countByCategory.get(cat.id)}
                  </span>
                )}
                {/* Edit + Delete buttons on hover */}
                <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(cat); }}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-brand-indigo hover:bg-brand-indigo/10 transition-all"
                    title={t("categories.edit")}
                    data-testid={`category-edit-btn-${cat.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRequest(cat.id); }}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title={t("detail.delete")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </>
            )}
          </button>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent
            side="right"
            className={cn(
              "rounded-lg px-3 h-9 flex items-center text-sm font-semibold shadow-md border-0 ml-1",
              isSelected
                ? "bg-highlight-active text-foreground"
                : "bg-card text-foreground"
            )}
          >
            {cat.name}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "h-full shrink-0 bg-background flex flex-col overflow-hidden transition-[width] duration-200 border-r border-border/30",
        collapsed ? "w-[56px]" : "w-[225px]"
      )}
      data-testid="category-sidebar"
    >
      {/* Header — page title + view tabs + collapse */}
      <div
        className={cn(
          "shrink-0 mt-3 mb-2",
          collapsed ? "px-1.5" : "px-2.5"
        )}
      >
        {/* Title row + collapse button */}
        <div className={cn("flex items-center h-9", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <span className="text-2xl font-semibold font-heading text-foreground pl-1">
              {t("page.title")}
            </span>
          )}
          <button
            onClick={() => onCollapse(!collapsed)}
            className="h-8 w-8 rounded-full flex items-center justify-center border border-black/[0.08] dark:border-white/[0.08] text-foreground/60 hover:text-foreground hover:bg-card transition-colors"
            title={collapsed ? t("categories.expand") : t("categories.collapse")}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* View mode tabs — hidden when collapsed */}
        {!collapsed && (
          <div className="mt-2 pl-1">
            <ViewTabBar
              tabs={VIEW_TABS.map(({ key, icon, tKey }) => ({
                id: key,
                label: t(tKey),
                icon,
              } as TabDef))}
              activeId={viewMode}
              onTabChange={(id) => onViewModeChange(id as ViewMode)}
              variant="segment"
            />
          </div>
        )}
      </div>

      {/* "All" category */}
      <TooltipProvider delayDuration={300}>
        <div className={cn("shrink-0", collapsed ? "px-1.5" : "px-2.5")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSelectCategory(null)}
                className={cn(
                  "flex items-center rounded-full transition-colors w-full",
                  collapsed
                    ? "h-[40px] w-[40px] justify-center mx-auto"
                    : "h-[40px] pl-[6px] pr-2 gap-2",
                  selectedCategoryId === null
                    ? "bg-highlight-active text-foreground font-semibold"
                    : "text-foreground/70 hover:bg-card hover:text-foreground"
                )}
                data-testid="category-item-all"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-black/[0.08] dark:border-white/[0.08]">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                {!collapsed && (
                  <>
                    <span className="text-[13px] font-medium flex-1">
                      {t("categories.all")}
                    </span>
                    {totalCount > 0 && (
                      <span className="text-[11px] tabular-nums text-muted-foreground font-medium shrink-0">
                        {totalCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent
                side="right"
                className={cn(
                  "rounded-lg px-3 h-9 flex items-center gap-2 text-sm font-semibold shadow-md border-0 ml-1",
                  selectedCategoryId === null
                    ? "bg-highlight-active text-foreground"
                    : "bg-card text-foreground"
                )}
              >
                {t("categories.all")}
                {totalCount > 0 && (
                  <span className="text-xs text-muted-foreground">{totalCount}</span>
                )}
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Separator */}
        {collapsed ? (
          <div className="mx-auto w-5 border-t border-border/30 my-2" />
        ) : (
          <div className="px-2.5 pt-2 pb-1.5">
            <span className="text-[11px] font-bold tracking-wide text-foreground/50 pl-1">
              {t("categories.label")}
            </span>
          </div>
        )}

        {/* Category list */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto min-h-0 pb-2 space-y-0.5",
            collapsed ? "px-1.5" : "px-2.5"
          )}
          data-testid="category-list"
        >
          {categories.map(renderCategoryItem)}

          {/* Empty state */}
          {categories.length === 0 && !collapsed && (
            <p className="text-xs text-muted-foreground/60 px-2 py-3 text-center">
              {t("categories.empty")}
            </p>
          )}
        </nav>
      </TooltipProvider>

      {/* Add new category */}
      <div className={cn("shrink-0 border-t border-border/30 pt-2 pb-3", collapsed ? "px-1.5" : "px-2.5")}>
        {addingNew && !collapsed ? (
          <div className="flex flex-col gap-2" data-testid="category-create-form">
            {/* Row 1: Emoji button + Name input + confirm/cancel */}
            <div className="flex items-center gap-1.5">
              {/* Emoji picker trigger */}
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center border transition-colors",
                      newIcon
                        ? "border-brand-indigo/30 bg-brand-indigo/5"
                        : "border-border/50 bg-muted hover:bg-card"
                    )}
                    title={t("categories.pickIcon")}
                    data-testid="category-emoji-trigger"
                  >
                    {newIcon ? (
                      <span className="text-sm">{newIcon}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">😀</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  className="w-[220px] p-2"
                  data-testid="category-emoji-picker"
                >
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5 px-0.5">
                    {t("categories.pickIcon")}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setNewIcon(newIcon === emoji ? "" : emoji);
                          setEmojiPickerOpen(false);
                          nameInputRef.current?.focus();
                        }}
                        className={cn(
                          "h-7 w-7 rounded flex items-center justify-center text-sm hover:bg-card transition-colors",
                          newIcon === emoji && "bg-highlight-active ring-1 ring-brand-indigo/30"
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {newIcon && (
                    <button
                      type="button"
                      onClick={() => { setNewIcon(""); setEmojiPickerOpen(false); }}
                      className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-0.5"
                    >
                      {t("categories.clearIcon")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") resetForm();
                }}
                placeholder={t("categories.newPlaceholder")}
                className="flex-1 min-w-0 h-8 px-2 text-[13px] rounded-lg bg-muted border border-border/50 focus:border-brand-indigo focus:outline-none transition-colors"
                autoFocus
                data-testid="category-new-input"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="h-7 w-7 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={resetForm}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Row 2: Color picker swatches */}
            <div className="px-0.5">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                {t("categories.pickColor")}
              </p>
              <div className="flex flex-wrap gap-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(newColor === color ? "" : color)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-all",
                      newColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:border-foreground/30 hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                    data-testid={`category-color-${color.slice(1)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (collapsed) onCollapse(false);
                  setAddingNew(true);
                }}
                className={cn(
                  "flex items-center rounded-full transition-colors text-foreground/60 hover:text-foreground hover:bg-card",
                  collapsed
                    ? "h-[40px] w-[40px] justify-center mx-auto"
                    : "h-[40px] pl-[6px] pr-2 gap-2 w-full"
                )}
                data-testid="category-add-btn"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-dashed border-border/50">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                {!collapsed && (
                  <span className="text-[13px] font-medium">
                    {t("categories.add")}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent
                side="right"
                className="rounded-lg px-3 h-9 flex items-center text-sm font-semibold shadow-md border-0 ml-1 bg-card text-foreground"
              >
                {t("categories.add")}
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deletePendingId !== null} onOpenChange={(open) => { if (!open) setDeletePendingId(null); }}>
        <AlertDialogContent data-testid="category-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("categories.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePendingTaskCount > 0
                ? t("categories.deleteDescWithTasks", {
                    name: deletePendingCategory?.name ?? "",
                    count: deletePendingTaskCount,
                  })
                : t("categories.deleteDesc", {
                    name: deletePendingCategory?.name ?? "",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("categories.cancelDelete")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t("categories.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
