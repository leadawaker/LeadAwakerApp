import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, BookOpen, Instagram, Facebook, Mail, Phone, BarChart3, Sparkles, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface HelpUpdate {
  id: string;
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  date: string;
}

const TOPBAR_HELP_UPDATES: HelpUpdate[] = [
  { id: "update-pipeline-donut", Icon: BarChart3, iconColor: "text-amber-600", title: "Pipeline Donut Chart", description: "Interactive funnel visualization with click-to-filter stages.", date: "Mar 2026" },
  { id: "update-ai-analysis", Icon: Sparkles, iconColor: "text-violet-600", title: "AI Campaign Analysis", description: "AI-generated summaries of campaign performance.", date: "Feb 2026" },
  { id: "update-campaign-tags", Icon: Tag, iconColor: "text-indigo-500", title: "Campaign Tags", description: "Organize campaigns with custom tag categories and colors.", date: "Feb 2026" },
];

export interface TopbarHelpProps {
  onNavigateDocs: () => void;
}

export function TopbarHelp({ onNavigateDocs }: TopbarHelpProps) {
  const { t } = useTranslation("crm");
  const [helpSocialOpen, setHelpSocialOpen] = useState(false);
  const [helpWhatsNewOpen, setHelpWhatsNewOpen] = useState(false);

  return (
    <span className="hidden md:contents">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconBtn data-testid="button-help-top" aria-label="Help">
                <span className="text-[13px] font-bold leading-none">?</span>
              </IconBtn>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
            {t("topbar.help")}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-black/[0.08] bg-white dark:bg-popover mt-2">
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1 focus:bg-transparent focus:text-blue-500 transition-colors"
            onClick={onNavigateDocs}
          >
            <BookOpen className="h-4 w-4" />
            {t("topbar.documentation")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Social Media — collapsible */}
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => setHelpSocialOpen((v) => !v)}
            className="flex items-center justify-between cursor-pointer py-2.5 rounded-xl mx-1 focus:bg-transparent focus:text-blue-500 transition-colors"
          >
            Social Media
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", helpSocialOpen && "rotate-180")} />
          </DropdownMenuItem>
          {helpSocialOpen && (
            <div className="mx-1 mb-1">
              <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer py-2 rounded-xl ml-3 focus:bg-transparent focus:text-blue-500 transition-colors">
                <a href="https://www.instagram.com/leadawaker/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer py-2 rounded-xl ml-3 focus:bg-transparent focus:text-blue-500 transition-colors">
                <a href="https://www.facebook.com/profile.php?id=61552291063345" target="_blank" rel="noopener noreferrer">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Facebook
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer py-2 rounded-xl ml-3 focus:bg-transparent focus:text-blue-500 transition-colors">
                <a href="mailto:gabriel@leadawaker.com">
                  <Mail className="h-4 w-4 text-foreground/60" />
                  Email
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="flex items-center gap-2 cursor-pointer py-2 rounded-xl ml-3 focus:bg-transparent focus:text-blue-500 transition-colors">
                <a href="https://wa.me/5547974002162" target="_blank" rel="noopener noreferrer">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  WhatsApp
                </a>
              </DropdownMenuItem>
            </div>
          )}
          <DropdownMenuSeparator />

          {/* What's New — collapsible */}
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => setHelpWhatsNewOpen((v) => !v)}
            className="flex items-center justify-between cursor-pointer py-2.5 rounded-xl mx-1 focus:bg-transparent focus:text-blue-500 transition-colors"
          >
            What's New
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", helpWhatsNewOpen && "rotate-180")} />
          </DropdownMenuItem>
          {helpWhatsNewOpen && (
            <div className="mx-1 mb-1 space-y-0.5">
              {TOPBAR_HELP_UPDATES.map((update) => (
                <div key={update.id} className="flex items-start gap-2.5 px-2 py-2 rounded-xl">
                  <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border border-black/[0.125] bg-transparent mt-0.5">
                    <update.Icon className={cn("h-3.5 w-3.5", update.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-foreground text-[12px]">{update.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{update.date}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{update.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
