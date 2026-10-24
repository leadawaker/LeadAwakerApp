// Agency only: which account the Socials page shows. Lists the accounts with Social switched on and
// drives the global account switcher, so the nav bar and the page always agree.
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SocialAccountOption } from "../lib/socialPage";

export function SocialAccountPicker({ options, selectedId, onSelect }: {
  options: SocialAccountOption[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation("social");
  const selected = options.find((o) => o.id === selectedId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="la-switcher" style={{ width: "auto", minWidth: 120, maxWidth: 240, gap: 10 }} aria-label={t("page.pickAccount")} data-testid="social-account-picker">
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.name ?? t("page.pickAccount")}</span>
          <ChevronDown size={12} style={{ flexShrink: 0 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-56 rounded-2xl shadow-xl border-border bg-background">
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => onSelect(o.id)}
            className={cn("flex items-center gap-2 cursor-pointer py-2.5 rounded-xl mx-1", o.id === selectedId && "bg-muted font-bold")}
            data-testid={`social-account-option-${o.id}`}>
            <span className="text-sm truncate flex-1">{o.name}</span>
            {o.id === selectedId && <Check className="h-4 w-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
