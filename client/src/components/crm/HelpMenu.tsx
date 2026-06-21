import { useLocation } from "wouter";
import { BookOpen, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * HelpPopover — a small 2-choice tooltip anchored to any trigger element.
 *
 * Choices:
 *   1. Documentation  → navigates to /platform/docs
 *   2. Chat with Gabriel → dispatches "open-founder-chat" window event
 *
 * Usage:
 *   <HelpPopover side="right">
 *     <button>Help</button>
 *   </HelpPopover>
 */
export function HelpPopover({
  children,
  side = "right",
  align = "start",
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const { t } = useTranslation("crm");
  const [, setLocation] = useLocation();

  const prefix = "/platform";

  const handleDocs = () => {
    onOpenChange?.(false);
    setLocation(`${prefix}/docs`);
  };

  const handleFounderChat = () => {
    onOpenChange?.(false);
    window.dispatchEvent(new CustomEvent("open-founder-chat"));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-52 p-1.5 rounded-2xl shadow-xl border-border/60 bg-white"
        data-testid="popover-help"
      >
        <button
          onClick={handleDocs}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/50 transition-colors text-foreground font-medium"
          data-testid="link-help-docs"
        >
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">{t("sidebar.documentation", "Documentation")}</span>
        </button>

        <button
          onClick={handleFounderChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/50 transition-colors text-foreground font-medium"
          data-testid="link-help-founder-chat"
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">{t("sidebar.messageFounder", "Chat with Gabriel")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * @deprecated Use HelpPopover instead. Kept to avoid breaking imports during migration.
 * The old full-screen slide-out help panel has been replaced by HelpPopover.
 */
export function HelpMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Render nothing — the old panel is replaced by HelpPopover.
  // CrmShell now handles help via HelpPanelContent internally.
  return null;
}
