import type { KBScope, KBInject, KBCampaign } from "../types";

// Short campaign label: "C1" from a name starting with C<n>, else positional index.
export function campaignShortName(campaign: KBCampaign, campaigns: KBCampaign[]): string {
  const match = campaign.name.match(/^(C\d+)/i);
  if (match) return match[1].toUpperCase();
  const idx = campaigns.findIndex((c) => c.id === campaign.id);
  return `C${idx + 1}`;
}

export function ScopeChip({ scope, campaigns, allLabel, hiddenLabel }: {
  scope: KBScope; campaigns: KBCampaign[]; allLabel: string; hiddenLabel: string;
}) {
  let label: string;
  let kind: "all" | "hidden" | "some";
  if (scope === "all" || (Array.isArray(scope) && campaigns.length > 0 && scope.length >= campaigns.length)) {
    label = allLabel; kind = "all";
  } else if (scope === "hidden" || (Array.isArray(scope) && scope.length === 0)) {
    label = hiddenLabel; kind = "hidden";
  } else {
    label = (scope as number[])
      .map((id) => {
        const c = campaigns.find((x) => x.id === id);
        return c ? campaignShortName(c, campaigns) : `C${id}`;
      })
      .join("+");
    kind = "some";
  }
  const styles = {
    all: { color: "var(--wine)", bg: "var(--wine-tint)", sh: "inset 0 0 0 1px rgba(94,34,48,0.14)" },
    some: { color: "var(--warn)", bg: "var(--warn-tint)", sh: "none" },
    hidden: { color: "var(--mute)", bg: "var(--bg)", sh: "var(--sh-inset-crisp)" },
  }[kind];
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: "var(--r-flush)", color: styles.color, background: styles.bg, boxShadow: styles.sh, whiteSpace: "nowrap" }}>{label}</span>
  );
}

export function InjectChip({ value }: { value: KBInject }) {
  if (!value || value === "always") return null;
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: "var(--r-flush)", color: "var(--stage-new)", background: "rgba(108,90,140,0.13)", whiteSpace: "nowrap" }}>{value}msg</span>
  );
}
