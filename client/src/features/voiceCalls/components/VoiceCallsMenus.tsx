import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Check, Filter, Layers } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GROUPS, SORTS, type ListOptions } from "../listOptions";
import { statusColors, VOICE_CALL_STATUSES, type VoiceCallStatus } from "../status";

const MENU = "glass-strong border-none";
const ITEM = "flex items-center gap-2 text-[12px]";

/** Same icon button + wine "not default" dot as the Chats topbar. */
function MenuButton({ icon, label, dot, children, width }: { icon: ReactNode; label: string; dot: boolean; children: ReactNode; width: string }) {
  return (
    <DropdownMenu>
      <div style={{ position: "relative" }}>
        <DropdownMenuTrigger asChild>
          <button className="la-btn la-btn--soft la-btn--icon" aria-label={label} title={label}>{icon}</button>
        </DropdownMenuTrigger>
        {dot && <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "var(--wine)", pointerEvents: "none" }} />}
      </div>
      <DropdownMenuContent align="end" className={`${width} ${MENU}`}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function Tick({ on }: { on: boolean }) {
  return on ? <Check className="h-3 w-3 ml-auto shrink-0" style={{ color: "var(--wine)" }} /> : null;
}

export function VoiceCallsMenus({ options, setOptions, languages }: {
  options: ListOptions;
  setOptions: (patch: Partial<ListOptions>) => void;
  languages: string[];
}) {
  const { t } = useTranslation("voiceCalls");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const filtered = options.statuses.length > 0 || options.languages.length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <MenuButton icon={<Filter className="h-4 w-4 shrink-0" />} label={t("menus.filter")} dot={filtered} width="w-52">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={ITEM}>
            <span className="flex-1">{t("menus.status")}</span>
            {options.statuses.length > 0 && <span className="text-[10px] tabular-nums font-semibold" style={{ color: "var(--wine)" }}>{options.statuses.length}</span>}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={`w-48 ${MENU}`}>
            {VOICE_CALL_STATUSES.map((s: VoiceCallStatus) => (
              <DropdownMenuItem key={s} className={ITEM} onClick={(e) => { e.preventDefault(); setOptions({ statuses: toggle(options.statuses, s) }); }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColors(s).bg, boxShadow: `inset 0 0 0 1px ${statusColors(s).text}` }} />
                <span className="flex-1">{t(`status.${s}`)}</span>
                <Tick on={options.statuses.includes(s)} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {languages.length > 1 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={ITEM}>
              <span className="flex-1">{t("menus.language")}</span>
              {options.languages.length > 0 && <span className="text-[10px] tabular-nums font-semibold" style={{ color: "var(--wine)" }}>{options.languages.length}</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={`w-40 ${MENU}`}>
              {languages.map((l) => (
                <DropdownMenuItem key={l} className={ITEM} onClick={(e) => { e.preventDefault(); setOptions({ languages: toggle(options.languages, l) }); }}>
                  <span className="flex-1">{l ? l.toUpperCase() : t("unknownLanguage")}</span>
                  <Tick on={options.languages.includes(l)} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {filtered && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[12px] text-muted-foreground" onClick={() => setOptions({ statuses: [], languages: [] })}>
              {t("menus.clearFilters")}
            </DropdownMenuItem>
          </>
        )}
      </MenuButton>

      <MenuButton icon={<ArrowUpDown className="h-4 w-4 shrink-0" />} label={t("menus.sort")} dot={options.sort !== "recent"} width="w-44">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s} className={ITEM} onClick={() => setOptions({ sort: s })} style={{ fontWeight: options.sort === s ? 600 : 400 }}>
            {t(`sort.${s}`)}<Tick on={options.sort === s} />
          </DropdownMenuItem>
        ))}
      </MenuButton>

      <MenuButton icon={<Layers className="h-4 w-4 shrink-0" />} label={t("menus.group")} dot={options.group !== "date"} width="w-44">
        {GROUPS.map((g) => (
          <DropdownMenuItem key={g} className={ITEM} onClick={() => setOptions({ group: g })} style={{ fontWeight: options.group === g ? 600 : 400 }}>
            {t(`group.${g}`)}<Tick on={options.group === g} />
          </DropdownMenuItem>
        ))}
      </MenuButton>
    </div>
  );
}
