import { useState } from "react";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "support"; text: string; at: string };

export function SupportChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 1,
      from: "support",
      text: "Hi — this is a mock support widget. How can we help?",
      at: new Date().toISOString(),
    },
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed left-4 bottom-4 w-[360px] max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-background shadow-xl overflow-hidden z-[60]"
      data-testid="panel-support-chat"
    >
      <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-muted/20">
        <div className="font-semibold" data-testid="text-support-title">LeadAwaker Support</div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted/40"
          data-testid="button-support-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[340px] overflow-auto p-3 space-y-2" data-testid="list-support-messages">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
            data-testid={`row-support-${m.id}`}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm border",
                m.from === "user" ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted/30 border-border",
              )}
              data-testid={`bubble-support-${m.id}`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-10 flex-1 rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Type a message…"
            data-testid="input-support-message"
          />
          <button
            type="button"
            onClick={() => {
              if (!value.trim()) return;
              const now = new Date().toISOString();
              setMsgs((prev) => [
                ...prev,
                { id: prev.length + 1, from: "user", text: value.trim(), at: now },
                {
                  id: prev.length + 2,
                  from: "support",
                  text: "Got it — this is mock. REAL: connect to Intercom/Helpdesk.",
                  at: new Date().toISOString(),
                },
              ]);
              setValue("");
            }}
            className="h-10 w-10 rounded-xl border border-border bg-background hover:bg-muted/30 grid place-items-center"
            data-testid="button-support-send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
