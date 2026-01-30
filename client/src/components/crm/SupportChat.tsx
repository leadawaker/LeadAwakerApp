import { useState } from "react";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "support"; text: string; at: string };

export function SupportChat({ open, onClose, inline }: { open: boolean; onClose: () => void; inline?: boolean }) {
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

  const content = (
    <div className="flex flex-col h-full bg-background">
      {!inline && (
        <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-muted/20 shrink-0">
          <div className="font-semibold" data-testid="text-support-title">LeadAwaker Support</div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-xl hover:bg-muted/40"
            data-testid="button-support-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-grow overflow-auto p-4 space-y-4" data-testid="list-support-messages">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
            data-testid={`row-support-${m.id}`}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm border",
                m.from === "user" ? "bg-primary text-primary-foreground border-primary/20" : "bg-muted/30 border-border",
              )}
              data-testid={`bubble-support-${m.id}`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-background shrink-0">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 flex-1 rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
            className="h-11 w-11 rounded-xl border border-border bg-background hover:bg-muted/30 grid place-items-center"
            data-testid="button-support-send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-support">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={onClose}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto flex flex-col">
        {content}
      </aside>
    </div>
  );
}
