import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Pencil, Check, BookOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useTranslation } from "react-i18next";

interface KBEntry {
  id: number;
  accountId: number;
  category: string;
  title: string;
  content: string;
  campaignIds?: number[] | null;
  minInboundMessages?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Campaign {
  id: number;
  name: string;
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "faq", title: "", content: "", campaignIds: null as number[] | null, minInboundMessages: null as number | null });
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const campaignPickerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/knowledge`);
      if (res.ok) setEntries(await res.json());
    } catch { /* */ }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    apiFetch(`/api/campaigns?accountId=${accountId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setCampaigns(data.map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [accountId]);

  useEffect(() => {
    if (!campaignPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (campaignPickerRef.current && !campaignPickerRef.current.contains(e.target as Node)) {
        setCampaignPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [campaignPickerOpen]);

  const campaignShortName = (campaign: Campaign) => {
    const match = campaign.name.match(/^(C\d+)/i);
    if (match) return match[1].toUpperCase();
    const idx = campaigns.findIndex(c => c.id === campaign.id);
    return `C${idx + 1}`;
  };

  const campaignLabel = (ids: number[] | null | undefined) => {
    if (ids === null || ids === undefined) return t("knowledge.campaigns.all", "All");
    if (ids.length === 0) return t("knowledge.campaigns.hidden", "Hidden");
    if (campaigns.length > 0 && ids.length >= campaigns.length) return t("knowledge.campaigns.all", "All");
    const names = ids
      .map(id => campaigns.find(c => c.id === id))
      .filter(Boolean)
      .map(c => campaignShortName(c!));
    return names.length > 0 ? names.join("+") : `${ids.length}C`;
  };

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
        setForm({ category: "faq", title: "", content: "", campaignIds: null, minInboundMessages: null });
        setAdding(false);
        setCampaignPickerOpen(false);
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
        setForm({ category: "faq", title: "", content: "", campaignIds: null, minInboundMessages: null });
        setCampaignPickerOpen(false);
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
    setForm({ category: entry.category, title: entry.title, content: entry.content, campaignIds: entry.campaignIds ?? null, minInboundMessages: entry.minInboundMessages ?? null });
    setAdding(false);
    setCampaignPickerOpen(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAdding(false);
    setForm({ category: "faq", title: "", content: "", campaignIds: null, minInboundMessages: null });
    setCampaignPickerOpen(false);
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
            onClick={() => { setAdding(true); setForm({ category: "faq", title: "", content: "", campaignIds: null }); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-indigo hover:bg-brand-indigo/10 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("knowledge.add", "Add Entry")}
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(adding || editingId) && (
        <div ref={formRef} className="rounded-xl bg-brand-indigo/5 border border-brand-indigo/20 p-3 space-y-2.5">
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
          {/* Campaign selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground/50 shrink-0">{t("knowledge.campaigns.label", "Campaigns")}</span>
            <div className="relative" ref={campaignPickerRef}>
              <button
                type="button"
                onClick={() => setCampaignPickerOpen(v => !v)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-[11px] border rounded-lg transition-colors",
                  form.campaignIds === null
                    ? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20"
                    : form.campaignIds.length === 0
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}
              >
                {campaignLabel(form.campaignIds)}
                <ChevronDown className="w-3 h-3" />
              </button>
              {campaignPickerOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-border/30 rounded-xl shadow-lg p-1.5 min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, campaignIds: null })); setCampaignPickerOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg hover:bg-foreground/5 text-left", form.campaignIds === null && "text-brand-indigo font-medium")}
                  >
                    <div className={cn("w-3 h-3 rounded-full border-2 shrink-0", form.campaignIds === null ? "border-brand-indigo bg-brand-indigo" : "border-foreground/20")} />
                    {t("knowledge.campaigns.allCampaigns", "All campaigns")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, campaignIds: [] })); setCampaignPickerOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg hover:bg-foreground/5 text-left", Array.isArray(form.campaignIds) && form.campaignIds.length === 0 && "text-red-500 font-medium")}
                  >
                    <div className={cn("w-3 h-3 rounded-full border-2 shrink-0", Array.isArray(form.campaignIds) && form.campaignIds.length === 0 ? "border-red-500 bg-red-500" : "border-foreground/20")} />
                    {t("knowledge.campaigns.hiddenFromAll", "Hidden from all")}
                  </button>
                  {campaigns.length > 0 && (
                    <>
                      <div className="h-px bg-border/20 my-1" />
                      {campaigns.map(c => {
                        const isChecked = Array.isArray(form.campaignIds) && form.campaignIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-foreground/5 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-3 h-3 accent-brand-indigo"
                              checked={isChecked}
                              onChange={(e) => {
                                setForm(f => {
                                  const current = Array.isArray(f.campaignIds) && f.campaignIds.length > 0 ? f.campaignIds : [];
                                  if (e.target.checked) return { ...f, campaignIds: [...current, c.id] };
                                  const next = current.filter(id => id !== c.id);
                                  return { ...f, campaignIds: next.length > 0 ? next : null };
                                });
                              }}
                            />
                            <span className="text-[11px] text-foreground/70">{c.name}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Deferral control */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground/50 shrink-0">Inject after</span>
            {([null, 1, 2, 3, 4, 5] as (number | null)[]).map(v => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setForm(f => ({ ...f, minInboundMessages: v }))}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded border transition-colors",
                  form.minInboundMessages === v
                    ? "bg-brand-indigo/15 text-brand-indigo border-brand-indigo/30 font-medium"
                    : "text-foreground/40 border-foreground/10 hover:border-foreground/20"
                )}
              >
                {v === null ? "always" : `${v}msg`}
              </button>
            ))}
          </div>
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
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium text-foreground/80 leading-tight">{entry.title}</p>
                          {(entry.campaignIds === null || entry.campaignIds === undefined) && (
                            <span className="text-[9px] px-1 py-0.5 bg-brand-indigo/10 text-brand-indigo rounded shrink-0">
                              {t("knowledge.campaigns.all", "All")}
                            </span>
                          )}
                          {Array.isArray(entry.campaignIds) && entry.campaignIds.length === 0 && (
                            <span className="text-[9px] px-1 py-0.5 bg-red-500/10 text-red-500 rounded shrink-0">
                              {t("knowledge.campaigns.hidden", "Hidden")}
                            </span>
                          )}
                          {Array.isArray(entry.campaignIds) && entry.campaignIds.length > 0 && campaigns.length > 0 && entry.campaignIds.length < campaigns.length && (
                            <span className="text-[9px] px-1 py-0.5 bg-amber-500/10 text-amber-600 rounded shrink-0">
                              {campaignLabel(entry.campaignIds)}
                            </span>
                          )}
                          {Array.isArray(entry.campaignIds) && entry.campaignIds.length > 0 && campaigns.length > 0 && entry.campaignIds.length >= campaigns.length && (
                            <span className="text-[9px] px-1 py-0.5 bg-brand-indigo/10 text-brand-indigo rounded shrink-0">
                              {t("knowledge.campaigns.all", "All")}
                            </span>
                          )}
                          {entry.minInboundMessages != null && entry.minInboundMessages !== 2 && (
                            <span className="text-[9px] px-1 py-0.5 bg-violet-500/10 text-violet-500 rounded shrink-0">
                              {entry.minInboundMessages}msg
                            </span>
                          )}
                        </div>
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
                    setForm({ category: cat, title: "", content: "", campaignIds: null });
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
