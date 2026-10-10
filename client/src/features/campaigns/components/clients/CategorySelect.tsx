import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { useDemoClients } from "../../api/demoClientsApi";
import "./clients.css";

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
      <SelectTrigger className="la-input dp-input h-auto" style={{ width: "100%" }}>
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
                className="la-input dp-input"
                style={{ flex: 1, minWidth: 0, padding: "6px 10px" }}
              />
              <button
                onClick={commitNew}
                disabled={!newCategory.trim()}
                className="la-btn la-btn--wine shrink-0 disabled:opacity-50"
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
              className="dp-menu-item"
              style={{ color: "var(--wine)" }}
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
