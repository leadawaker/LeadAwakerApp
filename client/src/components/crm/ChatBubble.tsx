import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import type { Interaction } from "@/types/models";

export function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  const content = item.content ?? "";
  const hasHtml = content.includes("<");

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")} data-testid={`row-chat-${item.id}`}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm border",
          outbound ? "bg-brand-indigo text-white border-brand-indigo/20" : "bg-card text-foreground border-border",
        )}
        data-testid={`bubble-chat-${item.id}`}
      >
        {hasHtml ? (
          <div
            className="whitespace-pre-wrap leading-relaxed [&_table]:text-[11px] [&_img]:max-w-[200px]"
            data-testid={`text-chat-${item.id}`}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(content, {
                ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "a", "ul", "ol", "li", "div", "span", "table", "tr", "td", "th", "img", "hr"],
                ALLOWED_ATTR: ["href", "target", "style", "src", "alt", "width", "height", "cellpadding", "cellspacing"],
                ADD_ATTR: ["target"],
              }),
            }}
          />
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed" data-testid={`text-chat-${item.id}`}>{content}</div>
        )}
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
