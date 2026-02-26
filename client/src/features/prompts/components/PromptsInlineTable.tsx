import { cn } from "@/lib/utils";
import { Pencil, Trash2, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import {
  PROMPT_TABLE_COLUMNS,
  getStatusBadgeClasses,
  getStatusLabel,
  getScoreColorClasses,
  getPromptId,
  type PromptColKey,
} from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   PromptsInlineTable — table view with h-[52px] rows, grouping, column visibility
   ════════════════════════════════════════════════════════════════════════════ */

interface PromptsInlineTableProps {
  prompts: any[];
  groupedRows: Map<string, any[]> | null;
  searchQuery: string;
  isFilterActive: boolean;
  togglingIds: Set<number>;
  onEdit: (prompt: any) => void;
  onDelete: (prompt: any) => void;
  onToggleStatus: (prompt: any) => void;
  visibleCols: Set<PromptColKey>;
  campaignMap: Map<number, string>;
}

export function PromptsInlineTable({
  prompts,
  groupedRows,
  searchQuery,
  isFilterActive,
  togglingIds,
  onEdit,
  onDelete,
  onToggleStatus,
  visibleCols,
  campaignMap,
}: PromptsInlineTableProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <DataEmptyState
          variant={searchQuery || isFilterActive ? "search" : "prompts"}
        />
      </div>
    );
  }

  // Always show actions column
  const columns = PROMPT_TABLE_COLUMNS.filter(
    (col) => col.key === "actions" || visibleCols.has(col.key),
  );

  function renderRow(p: any) {
    const promptId = getPromptId(p);
    const isToggling = togglingIds.has(promptId);

    return (
      <tr
        key={promptId}
        className="group/row h-[52px] border-b border-border/15 bg-card hover:bg-popover transition-colors"
        data-testid={`row-prompt-${promptId}`}
      >
        {columns.map((col) => {
          switch (col.key) {
            case "name":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] font-medium text-foreground truncate block">
                    {p.name || <span className="text-muted-foreground italic">Untitled</span>}
                  </span>
                </td>
              );

            case "campaign": {
              const cId = p.campaignsId || p.Campaigns_id;
              const cName = cId ? (campaignMap.get(cId) || `#${cId}`) : null;
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] text-muted-foreground truncate block">
                    {cName || "—"}
                  </span>
                </td>
              );
            }

            case "model":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] text-muted-foreground truncate block">
                    {p.model || "—"}
                  </span>
                </td>
              );

            case "status":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <button
                    onClick={() => onToggleStatus(p)}
                    disabled={isToggling}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                      getStatusBadgeClasses(p.status),
                      isToggling && "opacity-50 cursor-not-allowed",
                    )}
                    title={`Click to ${(p.status || "").toLowerCase() === "active" ? "archive" : "activate"}`}
                    data-testid={`button-toggle-status-${promptId}`}
                  >
                    {isToggling ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : (p.status || "").toLowerCase() === "active" ? (
                      <ToggleRight className="h-3 w-3" />
                    ) : (
                      <ToggleLeft className="h-3 w-3" />
                    )}
                    {getStatusLabel(p.status)}
                  </button>
                </td>
              );

            case "score":
              return (
                <td key={col.key} className="px-3 tabular-nums" style={{ width: col.width, minWidth: col.width }}>
                  {p.performanceScore != null ? (
                    <span className={cn("text-[12px] inline-flex items-center gap-1", getScoreColorClasses(p.performanceScore))}>
                      <Star className="h-3 w-3 fill-current" />
                      {p.performanceScore}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground/40">—</span>
                  )}
                </td>
              );

            case "useCase":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] text-muted-foreground truncate block">
                    {p.useCase || p.use_case || "—"}
                  </span>
                </td>
              );

            case "version":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] text-muted-foreground">
                    {p.version ? `v${p.version}` : "—"}
                  </span>
                </td>
              );

            case "updatedAt":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <span className="text-[12px] text-muted-foreground">
                    {p.updatedAt || p.updated_at
                      ? new Date(p.updatedAt || p.updated_at).toLocaleDateString()
                      : "—"}
                  </span>
                </td>
              );

            case "actions":
              return (
                <td key={col.key} className="px-3" style={{ width: col.width, minWidth: col.width }}>
                  <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-muted"
                      onClick={() => onEdit(p)}
                      title="Edit prompt"
                      data-testid={`button-edit-prompt-${promptId}`}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => onDelete(p)}
                      title="Delete prompt"
                      data-testid={`button-delete-prompt-${promptId}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" />
                    </button>
                  </div>
                </td>
              );

            default:
              return null;
          }
        })}
      </tr>
    );
  }

  function renderGroupHeader(label: string, count: number) {
    return (
      <tr key={`group-${label}`} className="h-[36px] bg-muted/60">
        <td colSpan={columns.length} className="px-3">
          <span className="text-[11px] font-semibold text-foreground/70">
            {label}
          </span>
          <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 900 }}>
          {/* ── Sticky header ─────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-20">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20"
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody>
            {groupedRows ? (
              Array.from(groupedRows.entries()).map(([label, groupPrompts]) => (
                <>{renderGroupHeader(label, groupPrompts.length)}{groupPrompts.map(renderRow)}</>
              ))
            ) : (
              prompts.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
