import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Lead } from "@/types/models";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LeadsTable({
  leads,
  activeLeadId,
  onSelect,
}: {
  leads: Lead[];
  activeLeadId: number | null;
  onSelect: (lead: Lead) => void;
}) {
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Lead",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="min-w-0" data-testid={`cell-lead-${lead.id}`}>
              <div className="font-semibold truncate" data-testid={`text-row-name-${lead.id}`}>
                {lead.full_name}
              </div>
              <div className="text-xs text-muted-foreground truncate" data-testid={`text-row-phone-${lead.id}`}>
                {lead.phone}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "conversion_status",
        header: "Status",
        cell: ({ row }) => (
          <Badge className="border" data-testid={`text-row-status-${row.original.id}`}>
            {row.original.conversion_status}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <span className="text-sm" data-testid={`text-row-priority-${row.original.id}`}>
            {row.original.priority}
          </span>
        ),
      },
      {
        accessorKey: "last_interaction_at",
        header: "Last touch",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground" data-testid={`text-row-last-${row.original.id}`}>
            {new Date(row.original.last_interaction_at).toLocaleString()}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-2xl bg-card overflow-hidden shadow-none border-none" data-testid="table-leads">
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-muted/30 border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 text-xs font-semibold text-muted-foreground" data-testid={`th-${h.id}`}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const lead = row.original;
              const active = activeLeadId === lead.id;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/60 last:border-b-0 cursor-pointer",
                    active ? "bg-primary/5" : "hover:bg-muted/20",
                  )}
                  onClick={() => onSelect(lead)}
                  data-testid={`row-lead-${lead.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground bg-background border-t border-border" data-testid="text-table-footer">
        Showing {leads.length} leads
      </div>
    </div>
  );
}
