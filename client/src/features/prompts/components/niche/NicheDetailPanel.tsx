import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Trash2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_NICHE, EMPTY_TEMPLATE, NICHE_WORD_GROUPS, PACK_FIELDS, resolveNicheIcon,
  type NicheLang, type NicheRow, type NicheTemplate, type NicheWordGroup, type TemplateFieldName,
} from "./nicheShared";

export function NicheDetailPanel({ row, lang, busyKey, onBack, onAdd, onRemove, onSaveTemplate, onDeleteNiche }: {
  row: NicheRow;
  lang: NicheLang;
  busyKey: string | null;
  onBack: () => void;
  onAdd: (group: NicheWordGroup, word: string) => void;
  onRemove: (group: NicheWordGroup, word: string) => void;
  onSaveTemplate: (field: TemplateFieldName, val: NicheTemplate) => void;
  onDeleteNiche?: () => void;
}) {
  const { t } = useTranslation("prompts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const [showPacks, setShowPacks] = useState(true);
  const isDefault = row.niche === DEFAULT_NICHE;
  const groups = row[lang];
  const NicheIcon = resolveNicheIcon(row.niche, isDefault);

  return (
    <div data-testid={`vocab-card-${row.niche}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button type="button" className="lg:hidden text-muted-foreground shrink-0" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0" style={{ background: "var(--wine)", opacity: 0.9 }}>
            <NicheIcon className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="serif truncate" style={{ fontSize: 17, color: "var(--ink)" }}>
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
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            onClick={() => setShowPacks((v) => !v)}
          >
            {showPacks ? t("vocabulary.hidePacks") : t("vocabulary.showPacks")}
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

      {showTemplate && !isDefault && (
        <div className="mb-5 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("vocabulary.templates.title")}
          </div>
          <div className="flex flex-col gap-3">
            <TemplateField
              label={t("vocabulary.templates.companyName")}
              value={row.companyNameTemplate?.[lang] ?? ""}
              busy={!!busyKey?.startsWith(`${row.niche}:template:companyNameTemplate`)}
              onSave={(v) => onSaveTemplate("companyNameTemplate", { ...EMPTY_TEMPLATE, ...row.companyNameTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.description")}
              value={row.descriptionTemplate?.[lang] ?? ""}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:descriptionTemplate`)}
              onSave={(v) => onSaveTemplate("descriptionTemplate", { ...EMPTY_TEMPLATE, ...row.descriptionTemplate, [lang]: v })}
            />
            <TemplateField
              label={t("vocabulary.templates.kb")}
              value={row.kbTemplate?.[lang] ?? ""}
              multiline
              busy={!!busyKey?.startsWith(`${row.niche}:template:kbTemplate`)}
              onSave={(v) => onSaveTemplate("kbTemplate", { ...EMPTY_TEMPLATE, ...row.kbTemplate, [lang]: v })}
            />
          </div>
        </div>
      )}

      {showPacks && (
        <div className="mb-5 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t("vocabulary.packs.title")}
          </div>
          <div className="flex flex-col gap-3">
            {PACK_FIELDS.map((field) => (
              <TemplateField
                key={field}
                label={t(`vocabulary.packs.${field}`)}
                value={row[field]?.[lang] ?? ""}
                multiline
                busy={!!busyKey?.startsWith(`${row.niche}:template:${field}`)}
                onSave={(v) => onSaveTemplate(field, { ...EMPTY_TEMPLATE, ...row[field], [lang]: v })}
              />
            ))}
          </div>
        </div>
      )}

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
