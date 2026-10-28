import { useTranslation } from "react-i18next";
import { LayoutGrid, Table2 } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { SessionsView } from "./useSessionsState";

/**
 * Table | Cards, the same pill switch as Live | Demo on the Phone page. It sits in the topbar's left
 * group right after the tabs, on the Sessions tab only. The switch sets its own 32px height inline,
 * so the phone's 44px tap target comes from a min-height on its tabs.
 */
export function SessionsViewSwitch({ view, onView }: { view: SessionsView; onView: (v: SessionsView) => void }) {
  const { t } = useTranslation("demos");
  const isPhone = useIsMobile(768);
  return (
    <div className="max-md:[&_[role=tab]]:min-h-11">
      <PillSwitch<SessionsView>
        items={[
          { id: "table", label: t("listView.table"), icon: Table2, color: "var(--wine)" },
          { id: "cards", label: t("listView.cards"), icon: LayoutGrid, color: "var(--wine)" },
        ]}
        value={view}
        onChange={onView}
        ariaLabel={t("listView.switchAria")}
        testId="sessions-view-switch"
        itemTestId={(v) => `sessions-view-${v}`}
        compact={isPhone}
      />
    </div>
  );
}
