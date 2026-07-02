import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_NICHE, EMPTY_NICHE_GROUPS, EMPTY_TEMPLATE,
  type NicheRow, type NicheWordGroup, type NicheLang, type NicheTemplate, type TemplateFieldName,
} from "./niche/nicheShared";
import { NicheDetailPanel } from "./niche/NicheDetailPanel";

// Niche list — kept in sync with BehaviorSectionFields and the DB.
const NICHE_OPTIONS = [
  "Kitchens", "Bathrooms", "Countertops", "Flooring", "General Contracting",
  "Solar Panels", "HVAC", "Roofing", "Landscaping", "Windows & Doors",
  "Painting", "Pest Control", "Pool Installation", "Moving Services",
  "Wellness", "Interior Design",
];

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
    field: TemplateFieldName,
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
        questionBank: EMPTY_TEMPLATE,
        badExamples: EMPTY_TEMPLATE,
        objectionExamples: EMPTY_TEMPLATE,
        scenarioExamples: EMPTY_TEMPLATE,
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
          <div key={row.niche} className="neu-raised rounded-lg p-4">
            <NicheDetailPanel
              row={row}
              lang={lang}
              busyKey={busy}
              onBack={() => {}}
              onAdd={(g, w) => mutateWord(row.niche, g, w, "POST")}
              onRemove={(g, w) => mutateWord(row.niche, g, w, "DELETE")}
              onSaveTemplate={(field, val) => saveTemplate(row.niche, field, val)}
              onDeleteNiche={row.niche === DEFAULT_NICHE ? undefined : () => deleteNiche(row.niche)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

