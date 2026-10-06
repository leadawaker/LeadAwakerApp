import { useTranslation } from "react-i18next";
import { Building2, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AccountOption { id: number; name: string }

/** Owner on Live: narrow the calls and stats to one client account. */
export function AccountFilter({ accounts, value, onChange }: {
  accounts: AccountOption[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}) {
  const { t } = useTranslation("voiceCalls");
  const current = accounts.find((a) => a.id === value);
  const label = current?.name ?? t("accountFilter.all");
  const tick = <Check className="h-3 w-3 ml-auto shrink-0" style={{ color: "var(--wine)" }} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("accountFilter.label")}
          title={t("accountFilter.label")}
          data-testid="voice-account-filter"
          className={`la-btn la-btn--soft${value != null ? " on" : ""}`}
          style={{ height: 32, flexShrink: 0, maxWidth: 200 }}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass-strong border-none">
        <DropdownMenuItem className="flex items-center gap-2 text-[12px]" onClick={() => onChange(undefined)} style={{ fontWeight: value == null ? 600 : 400 }}>
          <span className="flex-1">{t("accountFilter.all")}</span>
          {value == null && tick}
        </DropdownMenuItem>
        {accounts.map((a) => (
          <DropdownMenuItem key={a.id} className="flex items-center gap-2 text-[12px]" onClick={() => onChange(a.id)} style={{ fontWeight: value === a.id ? 600 : 400 }}>
            <span className="flex-1 truncate">{a.name}</span>
            {value === a.id && tick}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
