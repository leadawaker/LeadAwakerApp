import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  ListChecks,
} from "lucide-react";
import type { Task, TaskSubtask } from "@shared/schema";
import { useSubtasks } from "../api/tasksApi";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  type TaskStatus,
  type TaskPriority,
} from "../types";

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

// ── Build tree from flat task list ─────────────────────────────────────

function buildTree(tasks: Task[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const task of tasks) {
    map.set(task.id, { task, children: [] });
  }

  // Assign children
  for (const task of tasks) {
    const node = map.get(task.id)!;
    if (task.parentTaskId && map.has(task.parentTaskId)) {
      map.get(task.parentTaskId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by priority rank then title
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
    <div className="ml-6 border-l border-border/40 dark:border-white/10 pl-4 space-y-1 mt-1">
      {subtasks.map((st) => (
        <div
          key={st.id}
          className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground"
        >
          {/* Connector dot */}
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
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onTaskClick?: (taskId: number) => void;
}) {
  const { task, children } = node;
  const isExpanded = expanded.has(task.id);
  const hasChildren = children.length > 0;
  const StatusIcon = STATUS_ICON[task.status ?? "todo"] ?? Circle;
  const statusColor = STATUS_COLORS[(task.status as TaskStatus) ?? "todo"];
  const priorityColor = PRIORITY_COLORS[(task.priority as TaskPriority) ?? "low"];

  // Determine if this is a "goal" (root with children)
  const isGoal = depth === 0 && hasChildren;

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer",
          "hover:bg-muted/50 dark:hover:bg-white/5",
          isGoal && "font-semibold",
        )}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => onTaskClick?.(task.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={cn(
            "shrink-0 h-5 w-5 flex items-center justify-center rounded transition-colors",
            hasChildren
              ? "hover:bg-muted dark:hover:bg-white/10 text-muted-foreground"
              : "invisible",
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
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

      {/* Connector line + children */}
      {isExpanded && hasChildren && (
        <div className="border-l border-border/40 dark:border-white/10" style={{ marginLeft: `${depth * 24 + 18}px` }}>
          {children.map((child) => (
            <TreeNodeRow
              key={child.task.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      )}

      {/* Subtask leaves (only when expanded and no child tasks) */}
      {isExpanded && !hasChildren && (
        <div style={{ marginLeft: `${depth * 24 + 18}px` }}>
          <SubtaskLeaves taskId={task.id} />
        </div>
      )}
    </div>
  );
}

// ── Subtask count badge (lightweight — just shows count if available) ──

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

// ── Main TreeView ──────────────────────────────────────────────────────

export default function TasksTreeView({ tasks, searchQuery, onTaskClick }: TasksTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    // Auto-expand root nodes that have children
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

  const onToggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      <div className="space-y-0.5">
        {tree.map((node) => (
          <TreeNodeRow
            key={node.task.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
