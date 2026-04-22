import { useState, useEffect, useMemo, useCallback, Fragment, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Copy, Check, ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, Search, Hash, Mail, Linkedin, Phone, MessageSquare } from "lucide-react";
import {
  getOutreachTemplates,
  createOutreachTemplate,
  updateOutreachTemplate,
  deleteOutreachTemplate,
  type OutreachTemplate,
} from "../api/outreachTemplatesApi";

// ── Auto-assign niche colors from a palette ────────────────────────
const PALETTE = [
  "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981",
  "#EF4444", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#06B6D4", "#E11D48", "#A855F7", "#22C55E", "#0EA5E9",
];

function nicheColor(niche: string, allNiches: string[]): string {
  const idx = allNiches.indexOf(niche);
  return PALETTE[idx % PALETTE.length];
}

// ── Channel icon map ───────────────────────────────────────────────
const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
  whatsapp: MessageSquare,
};

// ── Highlight bracketed placeholders in template body ──────────────
function HighlightedBody({ text }: { text: string }) {
  const parts = text.split(/(\[.*?\]|\{\{.*?\}\})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^\[.*\]$/.test(part) ? (
          <span key={i} className="text-brand-indigo/80 bg-brand-indigo/5 rounded px-0.5">{part}</span>
        ) : /^\{\{.*\}\}$/.test(part) ? (
          <span key={i} className="text-amber-600 dark:text-amber-400 bg-amber-500/5 rounded px-0.5 font-medium">{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}

// ── Template card (view + inline edit) ──────────────────────────────
function TemplateCard({
  template,
  onSave,
  onDelete,
}: {
  template: OutreachTemplate;
  onSave: (data: Partial<OutreachTemplate>) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: template.name, body: template.body, subject: template.subject });

  const handleCopy = useCallback(() => {
    const text = template.subject
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [template]);

  const handleDelete = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(template.id);
  }, [confirmDelete, onDelete, template.id]);

  const startEdit = () => {
    setDraft({ name: template.name, body: template.body, subject: template.subject });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!draft.name?.trim() || !draft.body?.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: template.id, name: draft.name.trim(), body: draft.body.trim(), subject: draft.subject?.trim() || "" });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const ChannelIcon = template.channel ? CHANNEL_ICONS[template.channel] : null;
  const typeLabel = template.template_type?.replace(/_/g, " ");

  return (
    <div
      className={cn(
        "rounded-lg p-3 transition-all duration-200 relative",
        editing
          ? "bg-white dark:bg-card shadow-lg z-10 ring-2 ring-brand-indigo/30"
          : hovered
            ? "bg-white dark:bg-card shadow-lg z-10 ring-1 ring-brand-indigo/20"
            : "bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card",
      )}
      onMouseEnter={() => !editing && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header: id + name + type badge + channel icon + actions */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">#{template.id}</span>
        {editing ? (
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
            className="flex-1 min-w-0 text-[12px] font-semibold text-foreground bg-transparent border-b border-brand-indigo/30 outline-none px-0 py-0"
          />
        ) : (
          <span className="text-[12px] font-semibold text-foreground truncate">{template.name}</span>
        )}
        {typeLabel && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {typeLabel}
          </span>
        )}
        {ChannelIcon && (
          <ChannelIcon className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        )}
        {/* Actions */}
        <div className={cn("flex items-center gap-0.5 shrink-0 ml-auto transition-opacity", editing ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          {editing ? (
            <>
              <button onClick={cancelEdit} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" title="Cancel">
                <X className="h-3 w-3" />
              </button>
              <button onClick={saveEdit} disabled={saving} className="h-6 w-6 rounded flex items-center justify-center text-brand-indigo hover:bg-brand-indigo/10 transition-colors disabled:opacity-40" title="Save">
                <Check className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCopy} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors" title="Copy">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
              <button onClick={startEdit} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={handleDelete} className={cn("h-6 w-6 rounded flex items-center justify-center transition-colors", confirmDelete ? "bg-destructive/10 text-destructive" : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20")} title={confirmDelete ? "Click again to confirm" : "Delete"}>
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subject */}
      {(template.subject || editing) && (
        editing ? (
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder="Subject (optional)"
            className="w-full text-[11px] text-foreground/70 font-medium mb-1 bg-transparent border-b border-border/30 outline-none px-0 py-0 placeholder:text-muted-foreground/30"
          />
        ) : template.subject ? (
          <div className="text-[11px] text-foreground/70 font-medium mb-1 truncate">
            Subject: {template.subject}
          </div>
        ) : null
      )}

      {/* Body */}
      {editing ? (
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
          rows={10}
          className="w-full text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line bg-transparent outline-none resize-y px-0 py-0 focus:ring-0"
        />
      ) : (
        <div
          className={cn(
            "text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line transition-all duration-200",
            !hovered && "line-clamp-3"
          )}
        >
          <HighlightedBody text={template.body} />
        </div>
      )}
    </div>
  );
}

// ── Template editor (inline) ────────────────────────────────────────
function TemplateEditor({
  template,
  niches,
  onSave,
  onCancel,
}: {
  template: Partial<OutreachTemplate> | null;
  niches: string[];
  onSave: (data: Partial<OutreachTemplate>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: template?.name || "",
    niche: template?.niche || niches[0] || "",
    template_type: template?.template_type || "first_contact",
    subject: template?.subject || "",
    body: template?.body || "",
    channel: template?.channel || "",
    language: template?.language || "en",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({ ...form, id: template?.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-brand-indigo/30 bg-card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">
          {template?.id ? "Edit Template" : "New Template"}
        </span>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Template name"
          className="col-span-2 h-8 rounded-md border bg-transparent px-3 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        />
        <div className="relative col-span-1">
          <select
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            className="w-full h-8 rounded-md border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo appearance-none pr-6"
          >
            <option value="">No niche (general)</option>
            {niches.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={form.template_type}
            onChange={(e) => setForm({ ...form, template_type: e.target.value })}
            className="w-full h-8 rounded-md border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo appearance-none pr-6"
          >
            <option value="first_contact">First Contact</option>
            <option value="follow_up_1">Follow-up 1</option>
            <option value="follow_up_2">Follow-up 2</option>
            <option value="follow_up_3">Follow-up 3</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
        </div>
      </div>

      <input
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
        placeholder="Email subject line (optional)"
        className="w-full h-8 rounded-md border bg-transparent px-3 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
      />

      <textarea
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder="Template body... Use [bracketed instructions] for AI-personalized sections and {{variable}} for direct substitution"
        rows={10}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-[12px] outline-none resize-y focus:ring-1 focus:ring-brand-indigo leading-relaxed"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-8 px-4 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name || !form.body}
          className="h-8 px-5 rounded-md bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}

// ── Toolbar (rendered externally in ProspectsPage header) ───────────
export function TemplatesToolbar({
  search, onSearchChange,
  filterType, onFilterTypeChange,
  templateTypes, count, total,
  onNew,
}: {
  search: string; onSearchChange: (v: string) => void;
  filterType: string; onFilterTypeChange: (v: string) => void;
  templateTypes: string[]; count: number; total: number;
  onNew: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-[140px] h-7 rounded-md border bg-transparent pl-7 pr-2 text-[11px] outline-none focus:ring-1 focus:ring-brand-indigo focus:w-[200px] transition-all placeholder:text-muted-foreground/40"
        />
      </div>
      <div className="relative">
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="h-7 rounded-md border bg-transparent pl-2 pr-6 text-[11px] outline-none focus:ring-1 focus:ring-brand-indigo appearance-none"
        >
          <option value="all">All types</option>
          {templateTypes.map(tt => (
            <option key={tt} value={tt}>{tt.replace(/_/g, " ")}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
      </div>
      <span className="text-[10px] text-muted-foreground/40 tabular-nums">{count}/{total}</span>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-brand-indigo text-white text-[11px] font-semibold hover:opacity-90 transition-opacity shrink-0"
      >
        <Plus className="h-3 w-3" />
        New
      </button>
    </div>
  );
}

// ── Main templates view ─────────────────────────────────────────────
export interface TemplatesViewHandle {
  createNew: () => void;
  templateTypes: string[];
  filteredCount: number;
  totalCount: number;
}

function OutreachTemplatesViewInner({
  search = "",
  filterType = "all",
}: {
  search?: string;
  filterType?: string;
}, ref: React.Ref<TemplatesViewHandle>) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<OutreachTemplate> | null>(null);
  const [expandedNiches, setExpandedNiches] = useState<Set<string>>(new Set());

  const fetchTemplates = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const data = await getOutreachTemplates();
      setTemplates(data);
      setExpandedNiches(new Set(data.map((t) => t.niche || "__general__").filter(Boolean)));
    } catch (err) {
      console.error("Failed to fetch templates", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // All unique niches from data
  const niches = useMemo(() => {
    const all = new Set<string>();
    templates.forEach((t) => { if (t.niche) all.add(t.niche); });
    return Array.from(all).sort();
  }, [templates]);

  // Template types for filter
  const templateTypes = useMemo(() => {
    const all = new Set<string>();
    templates.forEach((t) => { if (t.template_type) all.add(t.template_type); });
    return Array.from(all).sort();
  }, [templates]);

  // Filter templates
  const filtered = useMemo(() => {
    let list = templates;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.body?.toLowerCase().includes(q) ||
        t.niche?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }
    if (filterType !== "all") {
      list = list.filter(t => t.template_type === filterType);
    }
    return list;
  }, [templates, search, filterType]);

  useImperativeHandle(ref, () => ({
    createNew: () => setEditingTemplate({}),
    templateTypes,
    filteredCount: filtered.length,
    totalCount: templates.length,
  }));

  // Group filtered templates by niche
  const grouped = useMemo(() => {
    const map = new Map<string, OutreachTemplate[]>();
    // General (no niche) bucket
    const general: OutreachTemplate[] = [];
    filtered.forEach((t) => {
      if (!t.niche) {
        general.push(t);
      } else {
        if (!map.has(t.niche)) map.set(t.niche, []);
        map.get(t.niche)!.push(t);
      }
    });
    // Generic first, then niches alphabetically
    const sorted = new Map<string, OutreachTemplate[]>();
    if (general.length > 0) sorted.set("__general__", general);
    // Move "generic" niche to front if it exists
    const nicheKeys = Array.from(map.keys()).sort();
    const genericKey = nicheKeys.find(k => k.toLowerCase() === "generic");
    if (genericKey) {
      sorted.set(genericKey, map.get(genericKey)!);
    }
    nicheKeys.filter(k => k.toLowerCase() !== "generic").forEach(k => sorted.set(k, map.get(k)!));
    return sorted;
  }, [filtered]);

  const toggleNiche = useCallback((niche: string) => {
    setExpandedNiches((prev) => {
      const next = new Set(prev);
      if (next.has(niche)) next.delete(niche);
      else next.add(niche);
      return next;
    });
  }, []);

  const handleSave = useCallback(async (data: Partial<OutreachTemplate>) => {
    if (data.id) {
      await updateOutreachTemplate(data.id, data);
    } else {
      await createOutreachTemplate(data);
    }
    setEditingTemplate(null);
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteOutreachTemplate(id);
    fetchTemplates();
  }, [fetchTemplates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-[12px]">
        Loading templates...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-[12px]">
        <span>Failed to load templates.</span>
        <button
          onClick={fetchTemplates}
          className="h-8 px-4 rounded-md bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-4 pt-1">
      <div className="space-y-2.5">
        {/* Editor (shown at top when creating new) */}
        {editingTemplate && !editingTemplate.id && (
          <TemplateEditor
            template={editingTemplate}
            niches={niches}
            onSave={handleSave}
            onCancel={() => setEditingTemplate(null)}
          />
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/50">
            <Hash className="h-8 w-8" />
            <p className="text-[12px]">
              {search || filterType !== "all" ? "No templates match your filters" : "No templates yet"}
            </p>
          </div>
        )}

        {/* Grouped by niche */}
        {Array.from(grouped.entries()).map(([niche, nicheTemplates], groupIdx) => {
          const isExpanded = expandedNiches.has(niche);
          const displayName = niche === "__general__" ? "General" : niche;
          const color = niche === "__general__" ? "#6B7280" : nicheColor(niche, niches);

          return (
            <div key={niche} className={groupIdx > 0 ? "mt-3" : ""}>
              {/* Niche header bar */}
              <button
                onClick={() => toggleNiche(niche)}
                className="w-full flex items-center gap-2.5 py-2 px-3 rounded-md transition-colors"
                style={{ backgroundColor: color + "12" }}
              >
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", !isExpanded && "-rotate-90")} style={{ color }} />
                <div className="w-0.5 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[13px] font-semibold text-foreground">{displayName}</span>
                <span className="text-[10px] text-muted-foreground/40 ml-auto tabular-nums">
                  {nicheTemplates.length}
                </span>
              </button>

              {/* Templates grid */}
              {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pt-2 pb-1">
                  {nicheTemplates.map((t) => (
                    <div key={t.id} className="group">
                      <TemplateCard
                        template={t}
                        onSave={handleSave}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const OutreachTemplatesView = forwardRef(OutreachTemplatesViewInner);
export default OutreachTemplatesView;
