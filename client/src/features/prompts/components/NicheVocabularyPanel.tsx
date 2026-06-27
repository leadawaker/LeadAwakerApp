import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, X, Trash2, Loader2,
  UtensilsCrossed, Bath, Layers, Grid3x3, Hammer, Sun, Wind,
  Home, TreePine, DoorOpen, Paintbrush, Bug, Waves, Truck,
  Heart, Sofa, Building2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Mirrors shared/schema's NICHE_WORD_GROUPS. Defined locally so the client
// bundle does not pull the Drizzle schema module just for these constants.
const NICHE_WORD_GROUPS = [
  "projectTerm", "proposalTerm", "decisionTerm", "advisorTerm", "visitTerm",
] as const;
type NicheWordGroup = (typeof NICHE_WORD_GROUPS)[number];
type NicheWordGroups = Record<NicheWordGroup, string[]>;
type NicheLang = "nl" | "en";
type NicheTemplate = { nl: string; en: string };
const EMPTY_NICHE_GROUPS: NicheWordGroups = {
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
};
const EMPTY_TEMPLATE: NicheTemplate = { nl: "", en: "" };

type NicheRow = {
  niche: string;
  nl: NicheWordGroups;
  en: NicheWordGroups;
  companyNameTemplate: NicheTemplate;
  descriptionTemplate: NicheTemplate;
  kbTemplate: NicheTemplate;
};

// Niche list — kept in sync with BehaviorSectionFields and the DB.
const NICHE_OPTIONS = [
  "Kitchens", "Bathrooms", "Countertops", "Flooring", "General Contracting",
  "Solar Panels", "HVAC", "Roofing", "Landscaping", "Windows & Doors",
  "Painting", "Pest Control", "Pool Installation", "Moving Services",
  "Wellness", "Interior Design",
];

const NICHE_ICONS: Record<string, React.ElementType> = {
  "Kitchens": UtensilsCrossed,
  "Bathrooms": Bath,
  "Countertops": Layers,
  "Flooring": Grid3x3,
  "General Contracting": Hammer,
  "Solar Panels": Sun,
  "HVAC": Wind,
  "Roofing": Home,
  "Landscaping": TreePine,
  "Windows & Doors": DoorOpen,
  "Painting": Paintbrush,
  "Pest Control": Bug,
  "Pool Installation": Waves,
  "Moving Services": Truck,
  "Wellness": Heart,
  "Interior Design": Sofa,
};

const DEFAULT_NICHE = "__default__";

export function NicheVocabularyPanel() {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [rows, setRows] = useState<NicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newNiche, setNewNiche] = useState("");
  const [lang, setLang] = useState<NicheLang>("nl");

  useEffect(() => {
    apiFetch("/api/niche-vocabulary")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NicheRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const defaultRow = useMemo(() => rows.find((r) => r.niche === DEFAULT_NICHE), [rows]);
  const existingNiches = useMemo(() => new Set(rows.map((r) => r.niche)), [rows]);
  const addableNiches = NICHE_OPTIONS.filter((n) => !existingNiches.has(n));

  const patchRow = useCallback((niche: string, updates: Partial<NicheRow>) => {
    setRows((prev) => prev.map((r) => (r.niche === niche ? { ...r, ...updates } : r)));
  }, []);

  const mutateWord = useCallback(async (
    niche: string, group: NicheWordGroup, word: string, method: "POST" | "DELETE",
  ) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setBusy(`${niche}:${group}`);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/words`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, word: trimmed, lang }),
      });
      if (!res.ok) throw new Error("save failed");
      const both = await res.json();
      patchRow(niche, both);
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [patchRow, t, toast, lang]);

  const saveTemplate = useCallback(async (
    niche: string,
    field: "companyNameTemplate" | "descriptionTemplate" | "kbTemplate",
    value: NicheTemplate,
  ) => {
    setBusy(`${niche}:template:${field}`);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("save failed");
      patchRow(niche, { [field]: value });
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [patchRow, t, toast]);

  const addNiche = useCallback(async () => {
    const niche = newNiche.trim();
    if (!niche || existingNiches.has(niche)) return;
    setBusy("__new__");
    try {
      const seed = defaultRow
        ? { nl: { ...defaultRow.nl }, en: { ...defaultRow.en } }
        : { nl: { ...EMPTY_NICHE_GROUPS }, en: { ...EMPTY_NICHE_GROUPS } };
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      });
      if (!res.ok) throw new Error("create failed");
      const both = await res.json();
      setRows((prev) => [...prev, {
        niche,
        ...both,
        companyNameTemplate: EMPTY_TEMPLATE,
        descriptionTemplate: EMPTY_TEMPLATE,
        kbTemplate: EMPTY_TEMPLATE,
      }].sort((a, b) => a.niche.localeCompare(b.niche)));
      setNewNiche("");
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [newNiche, existingNiches, defaultRow, t, toast]);

  const deleteNiche = useCallback(async (niche: string) => {
    setBusy(niche);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((r) => r.niche !== niche));
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [t, toast]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-5 overflow-y-auto h-full [scrollbar-width:thin]">
      <p className="text-sm text-muted-foreground max-w-[680px]">{t("vocabulary.intro")}</p>

      {/* Controls: EN/NL toggle + add a new niche */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="la-seg" role="tablist" aria-label={t("vocabulary.title")}>
          {(["nl", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`la-seg-btn${lang === l ? " on" : ""}`}
              onClick={() => setLang(l)}
              role="tab"
              aria-selected={lang === l}
            >
              {l === "nl" ? "🇳🇱" : "🇬🇧"} {t(`vocabulary.lang.${l}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            className="neu-inset rounded-md px-3 py-2 text-sm bg-transparent"
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            data-testid="vocab-new-niche-select"
          >
            <option value="">{t("vocabulary.addNichePlaceholder")}</option>
            {addableNiches.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            className="neu-raised rounded-md px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            onClick={addNiche}
            disabled={!newNiche || busy === "__new__"}
            data-testid="vocab-add-niche"
          >
            {busy === "__new__" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t("vocabulary.addNiche")}
          </button>
        </div>
      </div>

      {/* One card per niche */}
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <NicheCard
            key={row.niche}
            row={row}
            lang={lang}
            busyKey={busy}
            onAdd={(g, w) => mutateWord(row.niche, g, w, "POST")}
            onRemove={(g, w) => mutateWord(row.niche, g, w, "DELETE")}
            onSaveTemplate={(field, val) => saveTemplate(row.niche, field, val)}
            onDeleteNiche={row.niche === DEFAULT_NICHE ? undefined : () => deleteNiche(row.niche)}
          />
        ))}
      </div>
    </div>
  );
}

function NicheCard({ row, lang, busyKey, onAdd, onRemove, onSaveTemplate, onDeleteNiche }: {
  row: NicheRow;
  lang: NicheLang;
  busyKey: string | null;
  onAdd: (group: NicheWordGroup, word: string) => void;
  onRemove: (group: NicheWordGroup, word: string) => void;
  onSaveTemplate: (field: "companyNameTemplate" | "descriptionTemplate" | "kbTemplate", val: NicheTemplate) => void;
  onDeleteNiche?: () => void;
}) {
  const { t } = useTranslation("prompts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const isDefault = row.niche === "__default__";
  const groups = row[lang];
  const NicheIcon = isDefault ? Building2 : (NICHE_ICONS[row.niche] ?? Building2);

  return (
    <div className="neu-raised rounded-lg p-4" data-testid={`vocab-card-${row.niche}`}>
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ background: "var(--wine)", opacity: 0.9 }}>
            <NicheIcon className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
            {isDefault ? t("vocabulary.defaultNiche") : row.niche}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            onClick={() => setShowTemplate((v) => !v)}
          >
            {showTemplate ? t("vocabulary.hideTemplates") : t("vocabulary.showTemplates")}
          </button>
          {onDeleteNiche && (
            <>
              <button
                className="text-muted-foreground hover:text-red-500 transition-colors"
                onClick={() => setConfirmOpen(true)}
                disabled={busyKey === row.niche}
                aria-label={t("vocabulary.deleteNiche")}
                data-testid={`vocab-delete-${row.niche}`}
              >
                {busyKey === row.niche ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("vocabulary.delete.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("vocabulary.delete.body", { niche: row.niche })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("vocabulary.delete.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => { setConfirmOpen(false); onDeleteNiche(); }}
                    >
                      {t("vocabulary.delete.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Business profile templates */}
      {showTemplate && !isDefault && (
        <div className="mb-5 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("vocabulary.templates.title")}
          </div>
          <div className="flex flex-col gap-3">
            <TemplateField
              label={t("vocabulary.templates.companyName")}
              value={(row.companyNameTemplate ?? EMPTY_TEMPLATE)[lang]}
              busy={!!busyKey?.startsWith(`${row.niche}:template:companyNameTemplate`)}
              onSave={(v) => onSaveTemplate("companyNameTemplate", { ...row.companyNameTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.description")}
              value={(row.descriptionTemplate ?? EMPTY_TEMPLATE)[lang]}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:descriptionTemplate`)}
              onSave={(v) => onSaveTemplate("descriptionTemplate", { ...row.descriptionTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.kb")}
              value={(row.kbTemplate ?? EMPTY_TEMPLATE)[lang]}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:kbTemplate`)}
              onSave={(v) => onSaveTemplate("kbTemplate", { ...row.kbTemplate, [lang]: v })}
            />
          </div>
        </div>
      )}

      {/* Word groups */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {NICHE_WORD_GROUPS.map((group) => (
          <WordGroup
            key={group}
            label={t(`vocabulary.groups.${group}`)}
            placeholder={t("vocabulary.addWord")}
            words={groups[group]}
            busy={busyKey === `${row.niche}:${group}`}
            onAdd={(w) => onAdd(group, w)}
            onRemove={(w) => onRemove(group, w)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateField({ label, value, multiline = false, busy, onSave }: {
  label: string;
  value: string;
  multiline?: boolean;
  busy: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  // Sync when parent row updates (e.g. lang switch)
  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value]);

  const submit = () => { if (dirty) { onSave(draft); setDirty(false); } };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        {multiline ? (
          <textarea
            className="w-full bg-transparent border border-border/40 focus:border-[color:var(--wine)] outline-none rounded-md px-2.5 py-2 text-xs resize-none min-h-[64px] leading-relaxed placeholder:text-muted-foreground/50"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            onBlur={submit}
            rows={3}
          />
        ) : (
          <input
            className="w-full bg-transparent border border-border/40 focus:border-[color:var(--wine)] outline-none rounded-md px-2.5 py-2 text-xs placeholder:text-muted-foreground/50"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
        )}
        {busy && (
          <div className="absolute right-2 top-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        )}
        {dirty && !busy && (
          <div className="absolute right-2 top-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--wine)]" title="Unsaved" />
          </div>
        )}
      </div>
    </div>
  );
}

function WordGroup({ label, placeholder, words, busy, onAdd, onRemove }: {
  label: string;
  placeholder: string;
  words: string[];
  busy: boolean;
  onAdd: (word: string) => void;
  onRemove: (word: string) => void;
}) {
  const [input, setInput] = useState("");
  const submit = () => { if (input.trim()) { onAdd(input); setInput(""); } };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <span key={w} className="neu-inset-super-crisp pl-2.5 pr-1 py-0.5 text-xs inline-flex items-center gap-1" style={{ color: "var(--ink)" }}>
            {w}
            <button onClick={() => onRemove(w)} className="text-muted-foreground hover:text-red-500" aria-label="remove">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {words.length === 0 && <span className="text-xs text-muted-foreground/60 italic">—</span>}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-muted-foreground/70 text-sm leading-none select-none">+</span>
        <input
          className="bg-transparent border-0 border-b border-border/40 focus:border-[color:var(--wine)] outline-none px-1 py-1 text-xs flex-1 min-w-0 placeholder:text-muted-foreground/50"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          disabled={busy}
        />
        {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
