import type { HealthState } from "@shared/automationTypes";

const COLOR: Record<HealthState, string> = {
  healthy: "var(--good)",
  warning: "var(--warn)",
  late: "var(--warn)",
  failing: "var(--destructive)",
  waiting: "var(--mute)",
  idle: "var(--mute)",
  unknown: "var(--mute)",
};

export function HealthDot({ state, title }: { state: HealthState; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title ?? state}
      title={title ?? state}
      style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: COLOR[state], flexShrink: 0 }}
    />
  );
}
