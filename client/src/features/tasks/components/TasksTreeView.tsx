import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  ListChecks,
  Info,
  ChevronDown,
} from "lucide-react";
import type { Task, TaskCategory } from "@shared/schema";
import { useSubtasks, useTaskCategories } from "../api/tasksApi";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  STATUS_OPTIONS,
  type TaskStatus,
  type TaskPriority,
} from "../types";

// ── Expand/collapse persistence ─────────────────────────────────────
const EXPANDED_KEY = "tasks-tree-expanded";
const LEGEND_KEY = "tasks-tree-legend-open";

function loadExpanded(): Set<number> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set();
}

function saveExpanded(ids: Set<number>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

function loadLegendOpen(): boolean {
  try {
    const raw = localStorage.getItem(LEGEND_KEY);
    if (raw !== null) return raw === "true";
  } catch {}
  return false;
}

function saveLegendOpen(open: boolean) {
  try {
    localStorage.setItem(LEGEND_KEY, String(open));
  } catch {}
}

// ── Animated collapse wrapper ───────────────────────────────────────
function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      setHeight(open ? "auto" : 0);
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (open) {
      const h = el.scrollHeight;
      setHeight(0);
      requestAnimationFrame(() => {
        setHeight(h);
        const onEnd = () => { setHeight("auto"); el.removeEventListener("transitionend", onEnd); };
        el.addEventListener("transitionend", onEnd, { once: true });
      });
    } else {
      const h = el.scrollHeight;
      setHeight(h);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        height: height === "auto" ? "auto" : `${height}px`,
        overflow: "hidden",
        transition: height === "auto" ? undefined : "height 200ms ease-in-out",
      }}
    >
      {children}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────

interface TreeNode {
  task: Task;
  children: TreeNode[];
}

interface TasksTreeViewProps {
  tasks: Task[];
  searchQuery?: string;
  onTaskClick?: (taskId: number) => void;
}

// ── Status icons ───────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  cancelled: XCircle,
};

// ── Status background tints for node rows ──────────────────────────────
const STATUS_BG: Record<string, string> = {
  todo: "",
  in_progress: "bg-blue-50/50 dark:bg-blue-500/5",
  done: "bg-emerald-50/40 dark:bg-emerald-500/5",
  cancelled: "bg-gray-50/40 dark:bg-gray-500/5",
};

// ── Build tree from flat task list ─────────────────────────────────────

function buildTree(tasks: Task[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const task of tasks) {
    map.set(task.id, { task, children: [] });
  }

  for (const task of tasks) {
    const node = map.get(task.id)!;
    if (task.parentTaskId && map.has(task.parentTaskId)) {
      map.get(task.parentTaskId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const pa = priorityRank[a.task.priority ?? "low"] ?? 3;
      const pb = priorityRank[b.task.priority ?? "low"] ?? 3;
      if (pa !== pb) return pa - pb;
      return (a.task.title ?? "").localeCompare(b.task.title ?? "");
    });
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);

  return roots;
}

// ── Subtask leaves ─────────────────────────────────────────────────────

function SubtaskLeaves({ taskId }: { taskId: number }) {
  const { data: subtasks } = useSubtasks(taskId);
  if (!subtasks || subtasks.length === 0) return null;

  return (
    <div className="relative ml-6 pl-4 space-y-1 mt-1">
      <span
        className="absolute left-0 top-0 w-px bg-border/50 dark:bg-white/15"
        style={{ bottom: "12px" }}
      />
      {subtasks.map((st) => (
        <div
          key={st.id}
          className="relative flex items-center gap-2 py-0.5 text-xs text-muted-foreground"
        >
          <span className="absolute left-[-16px] top-1/2 w-3 h-px bg-border/50 dark:bg-white/15" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
          <span className={cn(st.isCompleted && "line-through opacity-60")}>
            {st.title}
          </span>
          {st.isCompleted && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Single tree node ───────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  expanded,
  onToggle,
  onTaskClick,
  isLast,
  categoryColorMap,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onTaskClick?: (taskId: number) => void;
  isLast?: boolean;
  categoryColorMap: Map<number, string>;
}) {
  const { task, children } = node;
  const isExpanded = expanded.has(task.id);
  const hasChildren = children.length > 0;
  const StatusIcon = STATUS_ICON[task.status ?? "todo"] ?? Circle;
  const statusColor = STATUS_COLORS[(task.status as TaskStatus) ?? "todo"];
  const priorityColor = PRIORITY_COLORS[(task.priority as TaskPriority) ?? "low"];
  const categoryColor = task.categoryId ? categoryColorMap.get(task.categoryId) : undefined;

  const isGoal = depth === 0 && hasChildren;
  const connectorLeft = depth * 24 + 18;

  // Status-based background tint class
  const statusBg = STATUS_BG[task.status ?? "todo"] ?? "";

  return (
    <div className="relative">
      {/* Horizontal branch connector (for non-root nodes) */}
      {depth > 0 && (
        <span
          className="absolute w-3 h-px bg-border/50 dark:bg-white/15"
          style={{ left: "-12px", top: "16px" }}
        />
      )}

      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer",
          "hover:bg-muted/50 dark:hover:bg-white/5",
          isGoal && "font-semibold",
          statusBg,
        )}
        style={{
          paddingLeft: `${depth * 24 + 8}px`,
          // Category color left border
          borderLeft: categoryColor ? `3px solid ${categoryColor}` : "3px solid transparent",
        }}
        onClick={() => onTaskClick?.(task.id)}
        data-testid={`tree-node-${task.id}`}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={cn(
            "shrink-0 h-5 w-5 flex items-center justify-center rounded transition-all",
            hasChildren
              ? "hover:bg-muted dark:hover:bg-white/10 text-muted-foreground"
              : "invisible",
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          data-testid={`tree-toggle-${task.id}`}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </button>

        {/* Status icon */}
        <StatusIcon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />

        {/* Emoji label */}
        {task.emoji && <span className="text-sm shrink-0">{task.emoji}</span>}

        {/* Title */}
        <span
          className={cn(
            "truncate text-sm",
            task.status === "done" && "line-through text-muted-foreground",
            task.status === "cancelled" && "line-through text-muted-foreground/60",
          )}
        >
          {task.title}
        </span>

        {/* Priority dot */}
        <span
          className="h-2 w-2 rounded-full shrink-0 ml-1"
          style={{ backgroundColor: priorityColor }}
          title={task.priority ?? "low"}
        />

        {/* Category color dot (when category has a color) */}
        {categoryColor && (
          <span
            className="h-2.5 w-2.5 rounded-sm shrink-0 border border-black/10 dark:border-white/20"
            style={{ backgroundColor: categoryColor }}
            title="Category"
            data-testid={`tree-category-color-${task.id}`}
          />
        )}

        {/* Children count badge */}
        {hasChildren && (
          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted dark:bg-white/10 px-1.5 py-0.5 rounded-full shrink-0">
            {children.length}
          </span>
        )}

        {/* Subtask indicator */}
        {!hasChildren && (
          <SubtaskCountBadge taskId={task.id} />
        )}
      </div>

      {/* Connector line + children (animated) */}
      {hasChildren && (
        <AnimatedCollapse open={isExpanded}>
          <div
            className="relative"
            style={{ marginLeft: `${connectorLeft}px` }}
          >
            <span
              className="absolute left-0 top-0 w-px bg-border/50 dark:bg-white/15"
              style={{ bottom: "16px" }}
            />
            {children.map((child, i) => (
              <TreeNodeRow
                key={child.task.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onTaskClick={onTaskClick}
                isLast={i === children.length - 1}
                categoryColorMap={categoryColorMap}
              />
            ))}
          </div>
        </AnimatedCollapse>
      )}

      {/* Subtask leaves (animated) */}
      {!hasChildren && (
        <AnimatedCollapse open={isExpanded}>
          <div style={{ marginLeft: `${connectorLeft}px` }}>
            <SubtaskLeaves taskId={task.id} />
          </div>
        </AnimatedCollapse>
      )}
    </div>
  );
}

// ── Subtask count badge ────────────────────────────────────────────────

function SubtaskCountBadge({ taskId }: { taskId: number }) {
  const { data: subtasks } = useSubtasks(taskId);
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.isCompleted).length;
  return (
    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
      <ListChecks className="h-3 w-3" />
      {done}/{subtasks.length}
    </span>
  );
}

// ── Color legend ──────────────────────────────────────────────────────

function TreeLegend({ categories }: { categories: TaskCategory[] }) {
  const [open, setOpen] = useState(() => loadLegendOpen());

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      saveLegendOpen(next);
      return next;
    });
  }, []);

  const categoriesWithColor = categories.filter((c) => c.color);

  return (
    <div className="mb-2" data-testid="tree-legend">
      <button
        onClick={toggleOpen}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
        data-testid="tree-legend-toggle"
      >
        <Info className="h-3 w-3" />
        <span>Legend</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
      </button>

      <AnimatedCollapse open={open}>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 pt-1.5 pb-1">
          {/* Status legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            {STATUS_OPTIONS.map((opt) => {
              const Icon = STATUS_ICON[opt.value] ?? Circle;
              const color = STATUS_COLORS[opt.value];
              return (
                <span key={opt.value} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" style={{ color }} />
                  <span>{opt.label}</span>
                </span>
              );
            })}
          </div>

          {/* Category color legend (only if categories have colors) */}
          {categoriesWithColor.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Category</span>
              {categoriesWithColor.map((cat) => (
                <span key={cat.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-sm border border-black/10 dark:border-white/20"
                    style={{ backgroundColor: cat.color! }}
                  />
                  <span>{cat.icon ? `${cat.icon} ` : ""}{cat.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </AnimatedCollapse>
    </div>
  );
}

// ── Main TreeView ──────────────────────────────────────────────────────

export default function TasksTreeView({ tasks, searchQuery, onTaskClick }: TasksTreeViewProps) {
  const { data: categories = [] } = useTaskCategories();

  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const persisted = loadExpanded();
    if (persisted.size > 0) return persisted;

    const roots = new Set<number>();
    const childIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!));
    for (const t of tasks) {
      if (!t.parentTaskId && childIds.has(t.id)) {
        roots.add(t.id);
      }
    }
    return roots;
  });

  const tree = useMemo(() => buildTree(tasks), [tasks]);

  // Build category id -> color map
  const categoryColorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories) {
      if (cat.color) {
        map.set(cat.id, cat.color);
      }
    }
    return map;
  }, [categories]);

  const onToggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveExpanded(next);
      return next;
    });
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-16">
        <ListChecks className="h-10 w-10 opacity-40" />
        <p className="text-sm">No tasks to display</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-2" data-testid="tasks-tree-view">
      {/* Color legend */}
      <TreeLegend categories={categories} />

      <div className="space-y-0.5">
        {tree.map((node, i) => (
          <TreeNodeRow
            key={node.task.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
            onTaskClick={onTaskClick}
            isLast={i === tree.length - 1}
            categoryColorMap={categoryColorMap}
          />
        ))}
      </div>
    </div>
  );
}
