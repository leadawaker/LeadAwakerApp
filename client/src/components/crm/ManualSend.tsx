import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ManualSend({ disabled }: { disabled: boolean }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-end gap-2" data-testid="form-manual-send">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground" data-testid="label-manual-message">
          Manual send
        </label>
        <textarea
          className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={disabled ? "Select a lead first" : "Type a message…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          data-testid="input-manual-message"
        />
      </div>
      <Button
        className="h-11 rounded-xl"
        disabled={disabled || value.trim().length === 0}
        onClick={() => {
          // MOCK: push to local state if needed
          // REAL: POST -> NocoDB Interactions table
          setValue("");
        }}
        data-testid="button-manual-send"
      >
        <Send className="h-4 w-4" />
        Send
      </Button>
    </div>
  );
}
