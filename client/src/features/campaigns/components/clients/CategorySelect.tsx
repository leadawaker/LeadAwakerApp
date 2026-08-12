import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { useDemoClients } from "../../api/demoClientsApi";

// Radix SelectItem cannot have value="" (throws), so "no category" is
// represented by this sentinel and swapped back to "" at the boundary.
const NONE = "__none__";

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation("campaigns");
  const { data: clients } = useDemoClients();
  const [showInput, setShowInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const categories = useMemo(() => {
    const set = new Set(
      (clients ?? [])
        .map((c) => (c.category ?? "").trim())
        .filter(Boolean),
    );
    if (value.trim()) set.add(value.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clients, value]);

  const commitNew = () => {
    const name = newCategory.trim();
    if (!name) return;
    onChange(name);
    setShowInput(false);
    setNewCategory("");
  };

  return (
    <Select value={value.trim() || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="la-input" style={{ width: "100%" }}>
        <span>{value.trim() || t("clients.noCategory", "Uncategorized")}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("clients.noCategory", "Uncategorized")}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
          {showInput ? (
            <div style={{ display: "flex", gap: 6, padding: "4px 6px" }} onKeyDown={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNew();
                }}
                placeholder={t("clients.newCategoryPlaceholder", "e.g. Wellness & Leisure")}
                maxLength={60}
                className="flex-1 h-8 rounded-md border border-black/[0.125] bg-background px-2.5 text-[12px] outline-none focus:border-brand-indigo"
              />
              <button
                onClick={commitNew}
                disabled={!newCategory.trim()}
                className="h-8 px-2 rounded-md bg-brand-indigo text-white disabled:opacity-50 text-[11px] shrink-0"
              >
                {t("clients.addCategory", "Add")}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--wine)",
                fontSize: 13,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t("clients.newCategory", "New category…")}
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
