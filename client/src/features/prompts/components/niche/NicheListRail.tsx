import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2 } from "lucide-react";
import { DEFAULT_NICHE, resolveNicheIcon, type NicheRow } from "./nicheShared";

export function NicheListRail({ rows, selectedNiche, onSelect, onAdd, addBusy }: {
  rows: NicheRow[];
  selectedNiche: string | null;
  onSelect: (niche: string) => void;
  onAdd: (niche: string) => Promise<boolean>;
  addBusy: boolean;
}) {
  const { t } = useTranslation("prompts");
  const [newNiche, setNewNiche] = useState("");

  const submitAdd = async () => {
    const trimmed = newNiche.trim();
    if (!trimmed) return;
    const ok = await onAdd(trimmed);
    if (ok) setNewNiche("");
  };

  return (
    <div
      className="flex flex-col min-h-0 w-full lg:w-[var(--toolbar-w)] lg:shrink-0"
      style={{ borderRight: "1px solid var(--line)", background: "var(--bg)" }}
    >
      <div className="flex items-center gap-1.5 p-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <input
          className="neu-inset rounded-md px-2.5 py-2 text-xs bg-transparent flex-1 min-w-0"
          value={newNiche}
          onChange={(e) => setNewNiche(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAdd(); } }}
          placeholder={t("vocabulary.addNichePlaceholder")}
          data-testid="vocab-new-niche-input"
        />
        <button
          className="neu-raised rounded-md px-2.5 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50 shrink-0"
          onClick={submitAdd}
          disabled={!newNiche.trim() || addBusy}
          data-testid="vocab-add-niche"
        >
          {addBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] p-2 flex flex-col gap-1">
        {rows.map((row) => {
          const isDefault = row.niche === DEFAULT_NICHE;
          const Icon = resolveNicheIcon(row.niche, isDefault);
          const isActive = row.niche === selectedNiche;
          return (
            <button
              key={row.niche}
              type="button"
              onClick={() => onSelect(row.niche)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors"
              style={{
                background: isActive ? "var(--card)" : "transparent",
                boxShadow: isActive ? "var(--sh-raised-crisp)" : "none",
              }}
              data-testid={`vocab-rail-${row.niche}`}
            >
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                style={{ background: "var(--wine)", opacity: isActive ? 0.9 : 0.6 }}
              >
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.75} />
              </div>
              <span
                className="text-sm truncate"
                style={{ color: "var(--ink)", fontWeight: isActive ? 600 : 400 }}
              >
                {isDefault ? t("vocabulary.defaultNiche") : row.niche}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
