import { useState } from "react";
import { ChevronRight, ChevronDown, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubAgentBlock } from "../hooks/useAgentChat";

export function SubAgentPill({ block }: { block: SubAgentBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1 mb-1">
      <button
        onClick={() => setExpanded((p) => !p)}
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
          "bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        <Bot className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[160px]">{block.name}</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="text-[10px] text-muted-foreground/60 ml-0.5">[done]</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-2 pl-2 border-l-2 border-border/40 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
          {block.content || "(no output)"}
        </div>
      )}
    </div>
  );
}
