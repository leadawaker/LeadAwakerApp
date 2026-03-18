import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, X, Check, BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";

interface KBEntry {
  id: number;
  accountId: number;
  category: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

const CATEGORIES = [
  "pricing",
  "services",
  "faq",
  "team",
  "hours",
  "location",
  "policies",
  "testimonials",
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  pricing: "💰",
  services: "🛠",
  faq: "❓",
  team: "👥",
  hours: "🕐",
  location: "📍",
  policies: "📋",
  testimonials: "⭐",
};

interface Props {
  accountId: number;
}

export default function KnowledgeBasePanel({ accountId }: Props) {
  const { t } = useTranslation("accounts");
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "faq", title: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));

  const fetchEntries = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge`);
      if (res.ok) setEntries(await res.json());
    } catch { /* */ }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchEntries();
        setForm({ category: "faq", title: "", content: "" });
        setAdding(false);
      }
    } catch { /* */ }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await fetchEntries();
        setEditingId(null);
        setForm({ category: "faq", title: "", content: "" });
      }
    } catch { /* */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge/${id}`, { method: "DELETE" });
      if (res.ok) setEntries(prev => prev.filter(e => e.id !== id));
    } catch { /* */ }
  };

  const startEdit = (entry: KBEntry) => {
    setEditingId(entry.id);
    setForm({ category: entry.category, title: entry.title, content: entry.content });
    setAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAdding(false);
    setForm({ category: "faq", title: "", content: "" });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group entries by category
  const grouped = CATEGORIES.reduce<Record<string, KBEntry[]>>((acc, cat) => {
    acc[cat] = entries.filter(e => e.category === cat);
    return acc;
  }, {});

  const populatedCategories = CATEGORIES.filter(cat => grouped[cat].length > 0);
  const emptyCategories = CATEGORIES.filter(cat => grouped[cat].length === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground/40 text-sm">
        {t("knowledge.loading", "Loading...")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-indigo" />
          <p className="text-[18px] font-semibold font-heading text-foreground">
            {t("knowledge.title", "Knowledge Base")}
          </p>
          <span className="text-[11px] text-foreground/40 ml-1">{entries.length} {t("knowledge.entries", "entries")}</span>
        </div>
        {!adding && !editingId && (
          <button
            onClick={() => { setAdding(true); setForm({ category: "faq", title: "", content: "" }); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-indigo hover:bg-brand-indigo/10 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("knowledge.add", "Add Entry")}
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(adding || editingId) && (
        <div className="rounded-xl bg-brand-indigo/5 border border-brand-indigo/20 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <select
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              className="text-[11px] bg-white dark:bg-white/10 border border-border/30 rounded-lg px-2 py-1.5 outline-none"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_ICONS[cat]} {t(`knowledge.categories.${cat}`, cat)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("knowledge.titlePlaceholder", "Entry title...")}
              className="flex-1 text-[12px] bg-white dark:bg-white/10 border border-border/30 rounded-lg px-2.5 py-1.5 outline-none"
            />
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={t("knowledge.contentPlaceholder", "Content the AI will use to answer questions...")}
            rows={3}
            className="w-full text-[12px] bg-white dark:bg-white/10 border border-border/30 rounded-lg px-2.5 py-1.5 outline-none resize-y"
          />
          <div className="flex items-center gap-2 justify-end">
            <button onClick={cancelEdit} className="text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">
              {t("knowledge.cancel", "Cancel")}
            </button>
            <button
              onClick={editingId ? handleUpdate : handleAdd}
              disabled={saving || !form.title.trim() || !form.content.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Check className="w-3 h-3" />
              {saving ? t("knowledge.saving", "Saving...") : editingId ? t("knowledge.update", "Update") : t("knowledge.save", "Save")}
            </button>
          </div>
        </div>
      )}

      {/* Entries by category */}
      {entries.length === 0 && !adding ? (
        <div className="rounded-xl bg-foreground/[0.03] border border-dashed border-foreground/10 p-6 text-center">
          <BookOpen className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
          <p className="text-[13px] text-foreground/50 mb-1">{t("knowledge.emptyTitle", "No knowledge base entries yet")}</p>
          <p className="text-[11px] text-foreground/30">{t("knowledge.emptyDescription", "Add pricing, services, FAQs, and more so the AI can answer lead questions accurately.")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {populatedCategories.map(cat => (
            <div key={cat} className="rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-foreground/[0.03] hover:bg-foreground/[0.05] transition-colors"
              >
                <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
                <span className="text-[12px] font-medium text-foreground/70 flex-1 text-left">
                  {t(`knowledge.categories.${cat}`, cat)}
                </span>
                <span className="text-[10px] text-foreground/40">{grouped[cat].length}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 text-foreground/30 transition-transform", expandedCategories.has(cat) && "rotate-180")} />
              </button>
              {expandedCategories.has(cat) && (
                <div className="border-l-2 border-brand-indigo/20 ml-3 pl-3 py-1 space-y-1">
                  {grouped[cat].map(entry => (
                    <div key={entry.id} className="group flex items-start gap-2 py-1.5 pr-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground/80 leading-tight">{entry.title}</p>
                        <p className="text-[11px] text-foreground/50 leading-relaxed whitespace-pre-wrap break-words mt-0.5">{entry.content}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEdit(entry)} className="p-1 hover:bg-foreground/10 rounded">
                          <Pencil className="w-3 h-3 text-foreground/40" />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-red-500/10 rounded">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Show empty categories as clickable prompts */}
          {emptyCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {emptyCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setAdding(true);
                    setForm({ category: cat, title: "", content: "" });
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-foreground/30 hover:text-foreground/60 border border-dashed border-foreground/10 hover:border-foreground/20 rounded-full transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {t(`knowledge.categories.${cat}`, cat)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
