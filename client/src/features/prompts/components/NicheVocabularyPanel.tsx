import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { NicheListRail } from "./niche/NicheListRail";
import { NicheDetailPanel } from "./niche/NicheDetailPanel";
import {
  DEFAULT_NICHE, EMPTY_NICHE_GROUPS, EMPTY_TEMPLATE,
  type NicheRow, type NicheWordGroup, type NicheLang, type NicheTemplate, type TemplateFieldName,
} from "./niche/nicheShared";

export function NicheVocabularyPanel() {
  const { t } = useTranslation("prompts");
  const { toast } = useToast();
  const [rows, setRows] = useState<NicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lang, setLang] = useState<NicheLang>("nl");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  useEffect(() => {
    apiFetch("/api/niche-vocabulary")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NicheRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedRows = useMemo(() => {
    const def = rows.find((r) => r.niche === DEFAULT_NICHE);
    const rest = rows.filter((r) => r.niche !== DEFAULT_NICHE).sort((a, b) => a.niche.localeCompare(b.niche));
    return def ? [def, ...rest] : rest;
  }, [rows]);

  useEffect(() => {
    if (selectedNiche || sortedRows.length === 0) return;
    const firstReal = sortedRows.find((r) => r.niche !== DEFAULT_NICHE);
    setSelectedNiche(firstReal ? firstReal.niche : sortedRows[0].niche);
  }, [sortedRows, selectedNiche]);

  const defaultRow = useMemo(() => rows.find((r) => r.niche === DEFAULT_NICHE), [rows]);
  const selectedRow = rows.find((r) => r.niche === selectedNiche) ?? null;

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

  const addNiche = useCallback(async (niche: string): Promise<boolean> => {
    if (!niche) return false;
    const dupe = rows.find((r) => r.niche.toLowerCase() === niche.toLowerCase());
    if (dupe) {
      toast({ title: t("vocabulary.duplicateNiche"), variant: "destructive" });
      setSelectedNiche(dupe.niche);
      setMobileView("detail");
      return false;
    }
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
      }]);
      setSelectedNiche(niche);
      setMobileView("detail");
      return true;
    } catch {
      toast({ title: t("vocabulary.saveError"), variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  }, [rows, defaultRow, t, toast]);

  const deleteNiche = useCallback(async (niche: string) => {
    setBusy(niche);
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((r) => r.niche !== niche));
      setSelectedNiche(null);
      setMobileView("list");
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
    <div className="flex flex-col gap-3 px-5 py-5 h-full min-h-0">
      <p className="text-sm text-muted-foreground max-w-[680px]">{t("vocabulary.intro")}</p>

      <div className="la-seg shrink-0" role="tablist" aria-label={t("vocabulary.title")}>
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

      <div className="flex flex-1 min-h-0 overflow-hidden rounded-lg" style={{ border: "1px solid var(--line)" }}>
        <div className={mobileView === "detail" ? "hidden lg:flex" : "flex"}>
          <NicheListRail
            rows={sortedRows}
            selectedNiche={selectedNiche}
            onSelect={(niche) => { setSelectedNiche(niche); setMobileView("detail"); }}
            onAdd={addNiche}
            addBusy={busy === "__new__"}
          />
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] p-4 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          {selectedRow ? (
            <NicheDetailPanel
              row={selectedRow}
              lang={lang}
              busyKey={busy}
              onBack={() => setMobileView("list")}
              onAdd={(g, w) => mutateWord(selectedRow.niche, g, w, "POST")}
              onRemove={(g, w) => mutateWord(selectedRow.niche, g, w, "DELETE")}
              onSaveTemplate={(field, val) => saveTemplate(selectedRow.niche, field, val)}
              onDeleteNiche={selectedRow.niche === DEFAULT_NICHE ? undefined : () => deleteNiche(selectedRow.niche)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t("vocabulary.selectNiche")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
