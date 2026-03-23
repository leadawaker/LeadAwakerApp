import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Copy, Check, ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, Mail, Linkedin, Phone } from "lucide-react";
import {
  getOutreachTemplates,
  createOutreachTemplate,
  updateOutreachTemplate,
  deleteOutreachTemplate,
  type OutreachTemplate,
} from "../api/outreachTemplatesApi";

// ── Channel icon helper ─────────────────────────────────────────────
const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
};

// ── Niche colors (match pipeline view) ──────────────────────────────
const NICHE_COLORS: Record<string, string> = {
  "Solar": "#F59E0B",
  "Insurance / Mortgage": "#3B82F6",
  "Legal / Personal Injury": "#6B7280",
  "Life Coaching": "#8B5CF6",
  "Renovation / Home Improvement": "#EC4899",
  "Data Analysis / B2B": "#10B981",
};

// ── Template card ───────────────────────────────────────────────────
function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: OutreachTemplate;
  onEdit: (t: OutreachTemplate) => void;
  onDelete: (id: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(() => {
    const text = template.subject
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [template]);

  const ChannelIcon = CHANNEL_ICON[template.channel] || Mail;

  return (
    <div className="rounded-xl border bg-white dark:bg-card p-4 min-h-[180px] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="text-[13px] font-semibold text-foreground truncate">
              {template.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {template.template_type?.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground/50 uppercase">
              {template.language}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors duration-150"
            title="Copy template"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onEdit(template)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors duration-150"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors duration-150"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Subject */}
      {template.subject && (
        <div className="text-[12px] text-foreground/80 font-medium mb-1.5 truncate">
          Subject: {template.subject}
        </div>
      )}

      {/* Body preview */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "text-[12px] text-muted-foreground leading-relaxed whitespace-pre-line cursor-pointer",
          !expanded && "line-clamp-[12]"
        )}
        title={expanded ? "Click to collapse" : "Click to expand"}
      >
        {template.body}
      </div>
      {!expanded && template.body && template.body.split("\n").length > 10 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[11px] text-brand-indigo/70 hover:text-brand-indigo mt-1 transition-colors duration-150"
        >
          Click to expand
        </button>
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
    channel: template?.channel || "email",
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
    <div className="rounded-xl border-2 border-brand-indigo/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">
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
          className="col-span-2 h-9 rounded-lg border bg-transparent px-3 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        />
        <select
          value={form.niche}
          onChange={(e) => setForm({ ...form, niche: e.target.value })}
          className="h-9 rounded-lg border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        >
          {niches.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={form.template_type}
          onChange={(e) => setForm({ ...form, template_type: e.target.value })}
          className="h-9 rounded-lg border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        >
          <option value="first_contact">First Contact</option>
          <option value="follow_up_1">Follow-up 1</option>
          <option value="follow_up_2">Follow-up 2</option>
          <option value="follow_up_3">Follow-up 3</option>
        </select>
        <select
          value={form.channel}
          onChange={(e) => setForm({ ...form, channel: e.target.value })}
          className="h-9 rounded-lg border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        >
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="phone">Phone</option>
        </select>
        <select
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
          className="h-9 rounded-lg border bg-transparent px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
        >
          <option value="en">English</option>
          <option value="nl">Dutch</option>
          <option value="pt">Portuguese</option>
        </select>
      </div>

      <input
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
        placeholder="Email subject line"
        className="w-full h-9 rounded-lg border bg-transparent px-3 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo"
      />

      <textarea
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder="Template body... Use {{contact_name}}, {{company}}, {{prospect_name}} as placeholders"
        rows={8}
        className="w-full rounded-lg border bg-transparent px-3 py-2 text-[12px] outline-none resize-y focus:ring-1 focus:ring-brand-indigo leading-relaxed"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-9 px-4 rounded-full text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.name || !form.body}
          className="h-9 px-5 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity duration-150"
        >
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}

// ── Main templates view ─────────────────────────────────────────────
export default function OutreachTemplatesView() {
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
      // Auto-expand all niches
      setExpandedNiches(new Set(data.map((t) => t.niche).filter(Boolean) as string[]));
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

  const niches = useMemo(() => {
    const all = new Set(templates.map((t) => t.niche).filter(Boolean));
    // Add known niches even if no templates exist yet
    ["Solar", "Insurance / Mortgage", "Legal / Personal Injury", "Life Coaching", "Renovation / Home Improvement", "Data Analysis / B2B"].forEach((n) => all.add(n));
    return Array.from(all).sort();
  }, [templates]);

  const grouped = useMemo(() => {
    const map = new Map<string, OutreachTemplate[]>();
    niches.forEach((n) => map.set(n, []));
    templates.forEach((t) => {
      const niche = t.niche || "Other";
      if (!map.has(niche)) map.set(niche, []);
      map.get(niche)!.push(t);
    });
    return map;
  }, [templates, niches]);

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
      <div className="flex items-center justify-center py-20 text-muted-foreground text-[13px]">
        Loading templates...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground text-[13px]">
        <span>Failed to load templates.</span>
        <button
          onClick={fetchTemplates}
          className="h-8 px-4 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 transition-opacity duration-150"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-3">
        {/* Add template button */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? "s" : ""} across {niches.length} niches
          </p>
          <button
            onClick={() => setEditingTemplate({})}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 transition-opacity duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </button>
        </div>

        {/* Editor (shown at top when creating new) */}
        {editingTemplate && !editingTemplate.id && (
          <TemplateEditor
            template={editingTemplate}
            niches={niches}
            onSave={handleSave}
            onCancel={() => setEditingTemplate(null)}
          />
        )}

        {/* Grouped by niche */}
        {niches.map((niche) => {
          const nicheTemplates = grouped.get(niche) || [];
          const isExpanded = expandedNiches.has(niche);
          const color = NICHE_COLORS[niche] || "#6B7280";

          return (
            <div key={niche} className="rounded-xl border bg-card overflow-hidden">
              {/* Niche header */}
              <button
                onClick={() => toggleNiche(niche)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 transition-colors duration-150"
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                }
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[13px] font-semibold text-foreground">{niche}</span>
                <span className="text-[11px] text-muted-foreground/50 ml-auto tabular-nums">
                  {nicheTemplates.length} template{nicheTemplates.length !== 1 ? "s" : ""}
                </span>
              </button>

              {/* Templates list */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5">
                  {nicheTemplates.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground/50 py-4 text-center">
                      No templates yet for this niche
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nicheTemplates.map((t) =>
                        editingTemplate?.id === t.id ? (
                          <TemplateEditor
                            key={t.id}
                            template={t}
                            niches={niches}
                            onSave={handleSave}
                            onCancel={() => setEditingTemplate(null)}
                          />
                        ) : (
                          <TemplateCard
                            key={t.id}
                            template={t}
                            onEdit={setEditingTemplate}
                            onDelete={handleDelete}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
