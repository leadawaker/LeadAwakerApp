// RightPanel: the one shell for create / edit forms (UI_STANDARDS 3.7, UI_PATTERNS 14).
// Desktop and tablet: a column inside the page's flex row, no backdrop. Mount it beside the
// page content (or in the detail column) and give it a width through `className`.
// Phones (below 768px): a full-screen panel above the bottom tab bar, unless the page wraps
// it in its own MobileSheet (`mobile="inline"`).
// Anatomy: header (title + close), scrolling `.neu-panel` body, sticky Cancel / Save footer.
// Escape and Cancel call `onClose`.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconBtn } from "@/components/ui/icon-btn";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useBackButtonClose } from "@/components/crm/mobile/MobileSheet";
import { cn } from "@/lib/utils";

export interface RightPanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional icon or avatar shown left of the title. */
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Replaces the default Cancel / Save footer. Pass `null` for no footer. */
  footer?: ReactNode;
  /** Extra actions in the default footer, left of the submit button (a Delete, say). */
  footerExtra?: ReactNode;
  /** Submit button label. No label and no `onSubmit` / `formId` = no submit button. */
  submitLabel?: ReactNode;
  onSubmit?: () => void;
  /** Id of a <form> inside the body: the submit button then submits that form. */
  formId?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Icon in the submit button (a spinner replaces it while `submitting`). */
  submitIcon?: ReactNode;
  cancelLabel?: ReactNode;
  /** Escape closes the panel (ignored while `submitting`). Default true. */
  closeOnEscape?: boolean;
  /** "fullscreen" (default): full-screen panel on phones. "inline": render in place,
   *  for pages that already put it in a MobileSheet. */
  mobile?: "fullscreen" | "inline";
  /** Outer container: width, border, radius. Default `w-[440px]` with a left border. */
  className?: string;
  /** Scrolling body: padding and spacing. Default `px-5 py-4 space-y-4`. */
  bodyClassName?: string;
  "data-testid"?: string;
}

export function RightPanel({
  title, subtitle, icon, onClose, children,
  footer, footerExtra, submitLabel, onSubmit, formId, submitting = false, submitDisabled = false, submitIcon,
  cancelLabel, closeOnEscape = true, mobile = "fullscreen",
  className, bodyClassName, "data-testid": testId,
}: RightPanelProps) {
  const { t } = useTranslation("crm");
  const isPhone = useIsMobile(768);
  const fullScreen = isPhone && mobile === "fullscreen";

  // Escape closes. Radix menus, selects and popovers handle their own Escape first
  // (capture phase) and mark the event, so an open dropdown closes without the panel.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(submitting);
  busyRef.current = submitting;
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || busyRef.current) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeOnEscape]);

  // Phone Back button closes the full-screen panel first (same as MobileSheet).
  useBackButtonClose(fullScreen, onClose);

  const hasSubmit = !!(submitLabel && (onSubmit || formId));
  const defaultFooter = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="la-btn la-btn--soft h-9 px-4 text-sm disabled:opacity-50"
        data-testid={testId ? `${testId}-cancel` : undefined}
      >
        {cancelLabel ?? t("actions.cancel")}
      </button>
      <div className="flex items-center gap-2">
        {footerExtra}
        {hasSubmit && (
          <button
            type={formId ? "submit" : "button"}
            form={formId}
            onClick={formId ? undefined : onSubmit}
            disabled={submitting || submitDisabled}
            className="la-btn la-btn--wine h-9 px-5 text-sm gap-1.5 disabled:opacity-50"
            data-testid={testId ? `${testId}-submit` : undefined}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitIcon}
            {submitLabel}
          </button>
        )}
      </div>
    </>
  );
  const footerContent = footer === undefined ? defaultFooter : footer;

  const shell = (
    <>
      {/* Header: title + close */}
      <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--line)]">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground font-heading leading-tight truncate">{title}</h2>
            {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
          </div>
        </div>
        <IconBtn onClick={onClose} aria-label={t("actions.close")} title={t("actions.close")}>
          <X className="h-4 w-4" />
        </IconBtn>
      </div>

      {/* Scrolling body: inputs and selects become inset wells */}
      <div className={cn("flex-1 min-h-0 overflow-y-auto neu-panel px-5 py-4 space-y-4", bodyClassName)}>
        {children}
      </div>

      {/* Sticky footer: Cancel left, actions right */}
      {footerContent != null && (
        <div className="shrink-0 px-5 py-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
          {footerContent}
        </div>
      )}
    </>
  );

  if (fullScreen) {
    return createPortal(
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col overflow-hidden bg-card"
        style={{ bottom: "var(--bottombar-h)", paddingTop: "var(--safe-top)" }}
        data-testid={testId}
      >
        {shell}
      </div>,
      document.body,
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden bg-card shrink-0",
        mobile === "inline" && isPhone ? "w-full flex-1" : "w-[440px] border-l border-[var(--line)]",
        !(mobile === "inline" && isPhone) && className,
      )}
      data-testid={testId}
    >
      {shell}
    </div>
  );
}
