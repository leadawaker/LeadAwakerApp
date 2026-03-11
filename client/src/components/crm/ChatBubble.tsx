import { cn } from "@/lib/utils";
import type { Interaction } from "@/types/models";

export function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")} data-testid={`row-chat-${item.id}`}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm border",
          outbound ? "bg-brand-indigo text-white border-brand-indigo/20" : "bg-card text-foreground border-border",
        )}
        data-testid={`bubble-chat-${item.id}`}
      >
        <div className="whitespace-pre-wrap leading-relaxed" data-testid={`text-chat-${item.id}`}>{item.content}</div>
        <div
          className={cn(
            "mt-1 text-[11px] opacity-80",
            outbound ? "text-white/80" : "text-muted-foreground",
          )}
          data-testid={`meta-chat-${item.id}`}
        >
          {new Date(item.created_at).toLocaleString()} • {item.type}
        </div>
      </div>
    </div>
  );
}
