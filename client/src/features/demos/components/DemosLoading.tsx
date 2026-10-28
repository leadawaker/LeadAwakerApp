import { Loader2 } from "lucide-react";

export function DemosLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--mute-2)" }} />
    </div>
  );
}
