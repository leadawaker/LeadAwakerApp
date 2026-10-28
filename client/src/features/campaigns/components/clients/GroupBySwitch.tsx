import { useTranslation } from "react-i18next";
import { CalendarDays, Shapes } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives";
import type { GroupBy } from "./personaView";

/**
 * Category | Date: how the persona list is sectioned. The same pill switch as the
 * Calls page's Live | Demo; below 768px its items grow to the page's 44px target.
 */
export function GroupBySwitch({ value, onChange }: { value: GroupBy; onChange: (next: GroupBy) => void }) {
  const { t } = useTranslation("demos");
  return (
    <div className="max-md:[&_[role=tab]]:!h-11">
      <PillSwitch<GroupBy>
        items={[
          { id: "category", label: t("personaList.groupBy.category"), icon: Shapes, color: "var(--wine)" },
          { id: "date", label: t("personaList.groupBy.date"), icon: CalendarDays, color: "var(--wine)" },
        ]}
        value={value}
        onChange={onChange}
        ariaLabel={t("personaList.groupBy.label")}
        testId="personas-group-by"
        itemTestId={(id) => `personas-group-${id}`}
        compact
      />
    </div>
  );
}
