import type { ReactNode } from "react";
import type { UsersRound } from "lucide-react";

export function PersonaEmptyState({ icon: Icon, title, body, action }: { icon: typeof UsersRound; title: string; body: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "64px 12px" }}>
      <span className="am-icon-tile" style={{ width: 48, height: 48, color: "var(--mute)" }}><Icon className="h-5 w-5" /></span>
      <div className="serif" style={{ fontSize: 20, color: "var(--ink)" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--mute)", maxWidth: 380, lineHeight: 1.55, margin: 0 }}>{body}</p>
      {action}
    </div>
  );
}
