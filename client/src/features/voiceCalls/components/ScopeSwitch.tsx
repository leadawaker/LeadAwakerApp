import { useTranslation } from "react-i18next";
import { Check, FlaskConical, Radio, TestTubeDiagonal } from "lucide-react";
import type { PillSwitchItem } from "@/components/crm/primitives/PillSwitch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { VoiceScope } from "../api/voiceCallsApi";

function useScopeItems(canTest: boolean, canDemo: boolean): PillSwitchItem<VoiceScope>[] {
  const { t } = useTranslation("voiceCalls");
  return [
    { id: "live", label: t("scope.live"), icon: Radio, color: "var(--good)", dot: true },
    ...(canTest ? [{ id: "test" as const, label: t("scope.test"), icon: TestTubeDiagonal, color: "var(--warn)" }] : []),
    ...(canDemo ? [{ id: "demo" as const, label: t("scope.demo"), icon: FlaskConical, color: "var(--wine)" }] : []),
  ];
}

/** The scopes as menu rows: each icon in its colour, a wine tick on the current one. */
function ScopeMenuContent({ items, scope, onScope }: { items: PillSwitchItem<VoiceScope>[]; scope: VoiceScope; onScope: (s: VoiceScope) => void }) {
  return (
    <DropdownMenuContent align="end" className="w-44 glass-strong border-none">
      {items.map(({ id, label, icon: ItemIcon, color }) => (
        <DropdownMenuItem
          key={id}
          className="flex items-center gap-2.5 text-[14px] py-2.5"
          onClick={() => onScope(id)}
          data-testid={`voice-tab-${id}`}
        >
          <ItemIcon className="h-4 w-4 shrink-0" style={{ color }} />
          <span style={{ fontWeight: id === scope ? 700 : 600, color: "var(--ink)" }}>{label}</span>
          {id === scope && <Check className="h-4 w-4 ml-auto shrink-0" style={{ color: "var(--wine)" }} />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}

function LiveDot({ style }: { style?: React.CSSProperties }) {
  return <span aria-hidden="true" className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0, ...style }} />;
}

/**
 * Agency only: Live (real calls on client lines), Tests (the calls staff make with Start
 * test call on an account's Voice tab) and, for the Owner, Demo (calls on the demo personas). The
 * three look nothing alike on purpose, so it is always clear which one is on screen: Live is
 * green with a radio mast and a pulsing dot, Tests amber with a test tube, Demo wine with a flask.
 *
 * One look everywhere (Calls and Chats, desktop and phone): a square neumorphic raised button
 * (--r-button corners, --sh-raised-crisp on --card) showing the current scope's icon in its
 * colour, opening a menu of the scopes (wine tick on the current one). Its size is the topbar
 * control height (--tb-ctl, 38px inside .la-page-header) and 40px in a phone header (`menu`,
 * where --tb-ctl is not set). `compact`: the 32px of a compact bar.
 */
export function ScopeSwitch({ scope, onScope, canDemo, canTest, compact, menu }: {
  scope: VoiceScope; onScope: (s: VoiceScope) => void; canDemo: boolean; canTest: boolean; compact?: boolean;
  menu?: boolean;
}) {
  const { t } = useTranslation("voiceCalls");
  const items = useScopeItems(canTest, canDemo);
  const current = items.find((i) => i.id === scope) ?? items[0];
  const Icon = current.icon;
  const size = compact ? 32 : menu ? "var(--tb-ctl, 40px)" : "var(--tb-ctl, 38px)";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("scope.aria")}: ${current.label}`}
          title={current.label}
          data-testid="voice-scope-switch"
          className="la-hit shrink-0 inline-flex items-center justify-center cursor-pointer transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
          style={{
            position: "relative",
            width: size,
            height: size,
            padding: 0,
            border: "none",
            borderRadius: "var(--r-button)",
            background: "var(--card)",
            boxShadow: "var(--sh-raised-crisp)",
            color: current.color,
          }}
        >
          <Icon size={menu ? 18 : 16} style={{ flexShrink: 0 }} />
          {current.dot && <LiveDot style={{ position: "absolute", top: 5, right: 5 }} />}
        </button>
      </DropdownMenuTrigger>
      <ScopeMenuContent items={items} scope={scope} onScope={onScope} />
    </DropdownMenu>
  );
}
