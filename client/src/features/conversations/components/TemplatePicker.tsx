import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchWhatsAppTemplates, sendWhatsAppTemplate, type WhatsAppTemplate } from "@/features/prospects/api/prospectsApi";
import { Send, FileText, ChevronLeft, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TemplatePickerProps {
  prospectId: number;
  prospectName: string;
  prospectCompany: string;
  onSent: () => void;
  onClose?: () => void; // undefined = can't close (window expired, forced)
}

/** Extract {{1}}, {{2}} etc. from template body text */
function extractVariableSlots(template: WhatsAppTemplate): string[] {
  const bodyComp = template.components.find((c) => c.type === "BODY");
  if (!bodyComp?.text) return [];
  const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
  return matches ? [...new Set(matches)].sort() : [];
}

/** Replace {{1}}, {{2}} etc. with actual values */
function renderPreview(template: WhatsAppTemplate, values: string[]): string {
  const bodyComp = template.components.find((c) => c.type === "BODY");
  if (!bodyComp?.text) return "";
  let text = bodyComp.text;
  values.forEach((val, i) => {
    text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), val || `{{${i + 1}}}`);
  });
  return text;
}

/** Group templates by name (each name can have multiple language variants) */
function groupByName(templates: WhatsAppTemplate[]): Record<string, WhatsAppTemplate[]> {
  const groups: Record<string, WhatsAppTemplate[]> = {};
  for (const t of templates) {
    (groups[t.name] ??= []).push(t);
  }
  return groups;
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  en_US: "English",
  nl: "Nederlands",
  pt_BR: "Portugues",
};

export function TemplatePicker({ prospectId, prospectName, prospectCompany, onSent, onClose }: TemplatePickerProps) {
  const { t } = useTranslation("conversations");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: fetchWhatsAppTemplates,
    staleTime: 5 * 60 * 1000, // cache 5 min (templates rarely change)
  });

  const [selected, setSelected] = useState<WhatsAppTemplate | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const grouped = useMemo(() => groupByName(templates), [templates]);
  const slots = useMemo(() => (selected ? extractVariableSlots(selected) : []), [selected]);
  const preview = useMemo(() => (selected ? renderPreview(selected, values) : ""), [selected, values]);

  // Auto-fill known variables when selecting a template
  function handleSelect(tpl: WhatsAppTemplate) {
    setSelected(tpl);
    const varSlots = extractVariableSlots(tpl);
    const autoFilled = varSlots.map((_, i) => {
      if (i === 0) return prospectName.split(" ")[0] || ""; // {{1}} = first name
      if (i === 1) return prospectCompany || ""; // {{2}} = company
      return "";
    });
    setValues(autoFilled);
  }

  async function handleSend() {
    if (!selected || sending) return;
    // Check all variables are filled
    const hasEmpty = slots.some((_, i) => !values[i]?.trim());
    if (hasEmpty) {
      toast({ title: t("templatePicker.fillAll"), variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await sendWhatsAppTemplate(prospectId, selected.name, selected.language, {
        body: values.map((v) => v.trim()),
      });
      toast({ title: t("templatePicker.sent") });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
      onSent();
    } catch (err: any) {
      toast({ title: t("templatePicker.sendFailed"), description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-3 pb-3">
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("templatePicker.loading")}
        </div>
      </div>
    );
  }

  if (isError || templates.length === 0) {
    return (
      <div className="px-3 pb-3">
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-5 text-center text-sm text-muted-foreground">
          <FileText className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
          {t("templatePicker.noTemplates")}
        </div>
      </div>
    );
  }

  // Template list view
  if (!selected) {
    return (
      <div className="px-3 pb-3">
        <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground">
                {t("templatePicker.title")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("templatePicker.subtitle")}
              </p>
            </div>
            {onClose && (
              <button onClick={onClose} className="text-muted-foreground/50 hover:text-muted-foreground shrink-0 mt-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] max-h-[200px] overflow-y-auto">
            {Object.entries(grouped).map(([name, variants]) => (
              <div key={name} className="px-3 py-2">
                <p className="text-[12px] font-medium text-foreground mb-1">{name.replace(/_/g, " ")}</p>
                <div className="flex flex-wrap gap-1">
                  {variants.map((v) => (
                    <button
                      key={`${v.name}-${v.language}`}
                      onClick={() => handleSelect(v)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-brand-indigo/30 text-brand-indigo hover:bg-brand-indigo/10 transition-colors"
                    >
                      {LANG_LABELS[v.language] || v.language}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Selected template: variable inputs + preview
  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-card shadow-sm overflow-hidden">
        {/* Header with back button */}
        <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
          <button
            onClick={() => { setSelected(null); setValues([]); }}
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">
              {selected.name.replace(/_/g, " ")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {LANG_LABELS[selected.language] || selected.language}
            </p>
          </div>
        </div>

        {/* Variable inputs */}
        {slots.length > 0 && (
          <div className="px-3 py-2 space-y-1.5 border-b border-black/[0.06] dark:border-white/[0.06]">
            {slots.map((slot, i) => (
              <div key={slot} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10 shrink-0 text-right">{slot}</span>
                <input
                  type="text"
                  value={values[i] || ""}
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = e.target.value;
                    setValues(next);
                  }}
                  className="flex-1 text-[12px] px-2 py-1 rounded border border-black/[0.1] dark:border-white/[0.1] bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                  placeholder={i === 0 ? prospectName.split(" ")[0] : i === 1 ? prospectCompany : ""}
                />
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">{t("templatePicker.preview")}</p>
            <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded px-2 py-1.5">
              {preview}
            </p>
          </div>
        )}

        {/* Send button */}
        <div className="px-3 py-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-indigo text-white text-[12px] font-medium hover:bg-brand-indigo/90 disabled:opacity-50 transition-colors"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {t("templatePicker.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
