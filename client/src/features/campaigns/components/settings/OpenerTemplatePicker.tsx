import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useOpenerTemplates, useUpdateOpenerTemplate,
  OPENER_TEMPLATE_TYPES,
  type OpenerTemplateRow, type OpenerTemplateEdit, type OpenerTemplateType,
} from "../../api/openerTemplatesApi";

export interface OpenerTemplate {
  id: string;
  title: { en: string; nl: string };
  body: { en: string; nl: string };
}

function toOpenerTemplate(row: OpenerTemplateRow): OpenerTemplate {
  return {
    id: row.id,
    title: { en: row.title_en, nl: row.title_nl },
    body: { en: row.body_en, nl: row.body_nl },
  };
}

interface OpenerTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uiLang: "en" | "nl";
  /** Resolves {variable} tokens in a template body against the current campaign/lead context. */
  resolveBody: (rawBody: string) => string;
  onPick: (template: OpenerTemplate) => void;
  /** Show only archetypes written for this conversation type (plus the "both"
   *  ones). Null on campaigns with a single opener: there is no type to filter
   *  by, so the whole library stays visible. */
  filterType?: OpenerTemplateType | null;
}

const TEXTAREA_STYLE: CSSProperties = {
  width: '100%', fontSize: 13, lineHeight: 1.5, padding: '8px 10px',
  border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
  background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical',
};

const INPUT_STYLE: CSSProperties = {
  width: '100%', fontSize: 12, fontWeight: 600, padding: '6px 10px',
  border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
  background: 'var(--surface)', color: 'var(--ink)',
};

export function OpenerTemplatePicker({
  open, onOpenChange, uiLang, resolveBody, onPick, filterType = null,
}: OpenerTemplatePickerProps) {
  const { t } = useTranslation("campaigns");
  const { toast } = useToast();
  const { data: allRows = [] } = useOpenerTemplates();
  const updateTemplate = useUpdateOpenerTemplate();

  // "both" always shows: most archetypes name neither an enquiry nor a quote and
  // read correctly either way. Retyping one to the other type takes it out of
  // this list, so the row being edited stays visible until the dialog reopens.
  const rows = filterType
    ? allRows.filter((r) => r.type === filterType || r.type === "both")
    : allRows;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OpenerTemplateEdit>({});

  const startEdit = (row: OpenerTemplateRow) => {
    setEditingId(row.id);
    setDraft({
      title_en: row.title_en, title_nl: row.title_nl,
      body_en: row.body_en, body_nl: row.body_nl,
      type: row.type,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = (id: string) => {
    updateTemplate.mutate({ id, data: draft }, {
      onSuccess: () => {
        toast({ description: t("config.templateSaved"), variant: "success" });
        setEditingId(null);
        setDraft({});
      },
      onError: () => {
        toast({ description: t("config.templateSaveFailed"), variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("config.openerTemplatesTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-muted-foreground -mt-2">{t("config.openerTemplatesHint")}</p>
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const tpl = toOpenerTemplate(row);
            const isEditing = editingId === row.id;
            return (
              <div
                key={row.id}
                style={{
                  border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                    {tpl.id}. {tpl.title[uiLang]}
                    {/* Only worth showing when the list is unfiltered: inside a
                        filtered list every row already matches the type. */}
                    {!filterType && row.type !== "both" && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                        {t(`config.templateTypeOptions.${row.type}`)}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="la-btn la-btn--soft"
                        aria-label={t("config.editTemplate")}
                        title={t("config.editTemplate")}
                        style={{ padding: '4px 6px', display: 'flex' }}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { onPick(tpl); onOpenChange(false); }}
                      className="la-btn la-btn--soft"
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}
                    >
                      {t("config.useTemplate")}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                        English
                      </span>
                      <input
                        type="text"
                        value={draft.title_en ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, title_en: e.target.value }))}
                        placeholder={t("config.templateTitleLabel")}
                        style={INPUT_STYLE}
                      />
                      <textarea
                        value={draft.body_en ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, body_en: e.target.value }))}
                        placeholder={t("config.templateBodyLabel")}
                        rows={4}
                        style={TEXTAREA_STYLE}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                        Nederlands
                      </span>
                      <input
                        type="text"
                        value={draft.title_nl ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, title_nl: e.target.value }))}
                        placeholder={t("config.templateTitleLabel")}
                        style={INPUT_STYLE}
                      />
                      <textarea
                        value={draft.body_nl ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, body_nl: e.target.value }))}
                        placeholder={t("config.templateBodyLabel")}
                        rows={4}
                        style={TEXTAREA_STYLE}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
                        {t("config.templateType")}
                      </span>
                      <select
                        value={draft.type ?? row.type}
                        onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as OpenerTemplateType }))}
                        className="la-input"
                        style={{ fontSize: 12 }}
                      >
                        {OPENER_TEMPLATE_TYPES.map((v) => (
                          <option key={v} value={v}>{t(`config.templateTypeOptions.${v}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => saveEdit(row.id)}
                        disabled={updateTemplate.isPending}
                        className="la-btn la-btn--soft"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                      >
                        <Check size={12} /> {t("config.saveTemplate")}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="la-btn la-btn--soft"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                      >
                        <X size={12} /> {t("config.cancelEditTemplate")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--mute-2)', whiteSpace: 'pre-wrap' }}>
                    {resolveBody(tpl.body[uiLang])}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
