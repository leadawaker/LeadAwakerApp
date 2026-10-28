import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDemoClients, type DemoLang } from "@/features/campaigns/api/demoClientsApi";
import { clientLabel, findClient, lacksLanguage, matchingClients } from "../../clientMatch";
import { TOUCH_ROW } from "../../touchTargets";

// The "no client" row's cmdk value: not a niche key anyone would type.
const NONE = "__no-client__";

/** Small uppercase language codes (EN NL). Muted when the Client has no version in the chosen language. */
function LangChips({ langs, muted }: { langs: DemoLang[]; muted: boolean }) {
  return (
    <span className="flex shrink-0 gap-1">
      {langs.map((l) => (
        <span
          key={l}
          className="rounded px-1 py-px"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            background: "var(--bg)",
            color: muted ? "var(--mute-2)" : "var(--mute)",
          }}
        >
          {l.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

/**
 * Pick the Client (demo persona) a prospect's demos wear, as a dropdown: the closed field shows
 * the chosen Client (name and language chips); opened, a search box over the list, with the
 * arrow keys, Enter and Escape. A Client without the chosen language stays pickable but is
 * flagged, because its links would be refused. `clearable` adds a "No client" row, since a
 * prospect may have no Client yet; the detail form turns it off because the server refuses to clear one.
 */
export function ClientPicker({ value, onChange, language, clearable = true }: {
  value: string;
  onChange: (niche: string) => void;
  language: DemoLang;
  clearable?: boolean;
}) {
  const { t } = useTranslation("demos");
  const { data: clients, isLoading, error } = useDemoClients();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const shown = useMemo(() => matchingClients(clients ?? [], search), [clients, search]);
  const chosen = findClient(clients, value);
  const chosenLacksLanguage = !!chosen && lacksLanguage(chosen, language);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };
  const pick = (niche: string) => {
    onChange(niche);
    changeOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("create.client")}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-input-bg px-3 py-2 text-left text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              TOUCH_ROW,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {chosen ? (
                <>
                  <span className="truncate" style={{ color: "var(--ink)" }}>{clientLabel(chosen)}</span>
                  <LangChips langs={chosen.languages ?? []} muted={chosenLacksLanguage} />
                </>
              ) : value ? (
                <span className="truncate" style={{ color: "var(--ink)" }}>{value}</span>
              ) : (
                <span className="truncate" style={{ color: "var(--mute)" }}>{t("createPanel.clientPlaceholder")}</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-32px)] p-0">
          {/* The list is filtered here (matchingClients), not by cmdk, so the search reads label, company and key. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("create.clientSearch")}
              aria-label={t("create.clientSearch")}
              className="max-md:h-11"
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center p-4" style={{ color: "var(--mute)" }}>
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : error ? (
                <p className="p-3" style={{ fontSize: 12.5, color: "var(--mute)" }}>{t("create.clientsFailed")}</p>
              ) : (
                <>
                  {clearable && value && (
                    <CommandItem value={NONE} onSelect={() => pick("")} className={cn("px-3 py-2", TOUCH_ROW)}>
                      <span style={{ fontSize: 13, color: "var(--mute)" }}>{t("createPanel.clientNone")}</span>
                    </CommandItem>
                  )}
                  {shown.length === 0 && (
                    <p className="p-3" style={{ fontSize: 12.5, color: "var(--mute)" }}>{t("create.noClientMatches")}</p>
                  )}
                  {shown.map((c) => {
                    const selected = c.niche === value;
                    const lacks = lacksLanguage(c, language);
                    return (
                      <CommandItem
                        key={c.niche}
                        value={c.niche}
                        onSelect={() => pick(c.niche)}
                        className={cn("items-start px-3 py-2 data-[selected=true]:bg-[var(--wine-tint)]", TOUCH_ROW, selected && "bg-[var(--wine-tint)]")}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate" style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? "var(--wine)" : "var(--ink)" }}>
                            {clientLabel(c)}
                          </span>
                          {lacks && (
                            <span style={{ fontSize: 11, color: "var(--mute)" }}>
                              {t("create.clientMissingLang", { language: language.toUpperCase() })}
                            </span>
                          )}
                        </span>
                        <LangChips langs={c.languages ?? []} muted={lacks} />
                        {selected && <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--wine)" }} />}
                      </CommandItem>
                    );
                  })}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {chosenLacksLanguage && (
        <p style={{ fontSize: 11.5, color: "var(--mute)" }}>{t("create.clientMissingLang", { language: language.toUpperCase() })}</p>
      )}
    </div>
  );
}
