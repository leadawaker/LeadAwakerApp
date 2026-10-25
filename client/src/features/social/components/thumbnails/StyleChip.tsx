// A saved style as a chip. Tap to apply it; once applied, a bin button appears that needs a second tap.
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleView } from "../../api/thumbnailsApi";
import { useTapAgain } from "../../lib/useTapAgain";

export function StyleChip({ style, active, deleting, onApply, onDelete }: { style: StyleView; active: boolean; deleting: boolean; onApply: () => void; onDelete: () => void }) {
  const { t } = useTranslation("social");
  const { armed, tap } = useTapAgain(onDelete);
  const label = t(armed ? "thumbnails.confirmDelete" : "thumbnails.styles.delete");
  return (
    <span className="row" style={{ gap: 0 }}>
      <button type="button" className={cn("la-btn", active ? "la-btn--wine" : "la-btn--soft")} style={{ padding: "4px 10px", minHeight: 28, fontSize: 11.5 }}
        onClick={onApply} data-testid={`thumb-style-${style.id}`}>
        {style.name}
      </button>
      {active && (
        <button type="button" className="la-btn la-btn--plain" style={{ padding: "4px 6px", minHeight: 28, fontSize: 11, color: armed ? "hsl(var(--destructive))" : undefined, fontWeight: armed ? 700 : undefined }}
          disabled={deleting} onClick={tap} title={label} aria-label={label} data-testid={`thumb-style-delete-${style.id}`}>
          <Trash2 size={12} />{armed && t("thumbnails.confirmDelete")}
        </button>
      )}
    </span>
  );
}
