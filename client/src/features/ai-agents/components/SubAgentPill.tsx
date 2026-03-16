import { useState } from "react";
import { ChevronRight, ChevronDown, Terminal, FileSearch, FolderOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubAgentBlock } from "../hooks/useAgentChat";

function getBlockIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("bash") || lower.includes("exec") || lower.includes("run")) return Terminal;
  if (lower.includes("read") || lower.includes("search") || lower.includes("grep")) return FileSearch;
  if (lower.includes("open") || lower.includes("file") || lower.includes("write")) return FolderOpen;
  return Wrench;
}

export function SubAgentPill({ block }: { block: SubAgentBlock }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getBlockIcon(block.name);

  return (
    <div className="mt-1 mb-1">
      <button
        onClick={() => setExpanded((p) => !p)}
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-0.5 rounded-full border transition-colors",
          "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40",
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[160px]">{block.name}</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-2 pl-2 border-l-2 border-emerald-200 dark:border-emerald-800/30 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
          {block.content || "(no output)"}
        </div>
      )}
    </div>
  );
}
