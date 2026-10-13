import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <PanelShell variant="flat">
      <div className="serif" style={{ fontSize: 22, color: "var(--ink)" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--mute)", marginTop: 6 }}>{body}</p>
    </PanelShell>
  );
}
