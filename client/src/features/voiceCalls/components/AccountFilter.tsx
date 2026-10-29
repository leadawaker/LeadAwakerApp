import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import {
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileDrawerOption, MobileDrawerSubheading } from "@/components/crm/mobile/MobileListHeader";

export interface AccountOption { id: number; name: string }

/**
 * Owner on Live: narrow the calls and stats to one client account. Starts on the
 * sidebar's account; picking here only changes this page (a sidebar switch wins again).
 */
export interface AccountFilterProps {
  accounts: AccountOption[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}

const ITEM = "flex items-center gap-2 text-[12px]";

/** "Account" inside the Filter menu (desktop). */
export function AccountSubmenu({ accounts, value, onChange }: AccountFilterProps) {
  const { t } = useTranslation("voiceCalls");
  const tick = <Check className="h-3 w-3 ml-auto shrink-0" style={{ color: "var(--wine)" }} />;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={ITEM} data-testid="voice-account-filter">
        <span className="flex-1">{t("accountFilter.label")}</span>
        {value != null && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--wine)" }} />}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 max-h-80 overflow-y-auto glass-strong border-none">
        <DropdownMenuItem className={ITEM} onClick={() => onChange(undefined)} style={{ fontWeight: value == null ? 600 : 400 }}>
          <span className="flex-1">{t("accountFilter.all")}</span>
          {value == null && tick}
        </DropdownMenuItem>
        {accounts.map((a) => (
          <DropdownMenuItem key={a.id} className={ITEM} onClick={() => onChange(a.id)} style={{ fontWeight: value === a.id ? 600 : 400 }}>
            <span className="flex-1 truncate">{a.name}</span>
            {value === a.id && tick}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** "Account" inside the phone's Filter drawer. */
export function AccountDrawerOptions({ accounts, value, onChange }: AccountFilterProps) {
  const { t } = useTranslation("voiceCalls");
  return (
    <>
      <MobileDrawerSubheading>{t("accountFilter.label")}</MobileDrawerSubheading>
      <MobileDrawerOption label={t("accountFilter.all")} selected={value == null} onClick={() => onChange(undefined)} />
      {accounts.map((a) => (
        <MobileDrawerOption key={a.id} label={a.name} selected={value === a.id} onClick={() => onChange(a.id)} />
      ))}
    </>
  );
}
