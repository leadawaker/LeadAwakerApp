import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPENER_TEMPLATES, type OpenerTemplate } from "./openerTemplates";

interface OpenerTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uiLang: "en" | "nl";
  /** Resolves {variable} tokens in a template body against the current campaign/lead context. */
  resolveBody: (rawBody: string) => string;
  onPick: (template: OpenerTemplate) => void;
}

export function OpenerTemplatePicker({
  open, onOpenChange, uiLang, resolveBody, onPick,
}: OpenerTemplatePickerProps) {
  const { t } = useTranslation("campaigns");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("config.openerTemplatesTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-muted-foreground -mt-2">{t("config.openerTemplatesHint")}</p>
        <div className="flex flex-col gap-3">
          {OPENER_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                border: '1px solid var(--line)', borderRadius: 'var(--r-input, 10px)',
                padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {tpl.id}. {tpl.title[uiLang]}
                </span>
                <button
                  type="button"
                  onClick={() => { onPick(tpl); onOpenChange(false); }}
                  className="la-btn la-btn--soft"
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}
                >
                  {t("config.useTemplate")}
                </button>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--mute-2)', whiteSpace: 'pre-wrap' }}>
                {resolveBody(tpl.body[uiLang])}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
