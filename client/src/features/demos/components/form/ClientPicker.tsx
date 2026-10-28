import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDemoClients, type DemoClientSummary, type DemoLang } from "@/features/campaigns/api/demoClientsApi";
import { TOUCH_ROW } from "../../touchTargets";

/** The Clients that match the search: by label, company or key. Pure, so it is easy to read on its own. */
function matching(clients: DemoClientSummary[], search: string): DemoClientSummary[] {
  const q = search.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) => [c.label, c.companyName, c.niche].some((s) => (s || "").toLowerCase().includes(q)));
}

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
 * Pick the Client (demo persona) a prospect's demos wear: a search box over a scrolling list.
 * Choosing the selected Client again clears the choice, since a prospect may have no Client yet.
 * A Client without the chosen language stays pickable but is flagged, because its links would be refused.
 */
export function ClientPicker({ value, onChange, language }: {
  value: string;
  onChange: (niche: string) => void;
  language: DemoLang;
}) {
  const { t } = useTranslation("demos");
  const { data: clients, isLoading, error } = useDemoClients();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => matching(clients ?? [], search), [clients, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mute-2)" }} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("create.clientSearch")}
          aria-label={t("create.clientSearch")}
          className={cn("pl-8", TOUCH_ROW)}
        />
      </div>

      <div
        role="listbox"
        aria-label={t("create.client")}
        className="overflow-y-auto rounded-[var(--r-surface)]"
        style={{ maxHeight: 280, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-4" style={{ color: "var(--mute)" }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="p-3" style={{ fontSize: 12.5, color: "var(--mute)" }}>
            {t("create.clientsFailed")}
          </p>
        ) : shown.length === 0 ? (
          <p className="p-3" style={{ fontSize: 12.5, color: "var(--mute)" }}>
            {t("create.noClientMatches")}
          </p>
        ) : (
          shown.map((c) => {
            const selected = c.niche === value;
            const langs = c.languages ?? [];
            const lacksLanguage = !langs.includes(language);
            return (
              <button
                key={c.niche}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(selected ? "" : c.niche)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--wine-tint)]",
                  TOUCH_ROW,
                  selected && "bg-[var(--wine-tint)]",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate" style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? "var(--wine)" : "var(--ink)" }}>
                    {c.label || c.niche}
                  </span>
                  {lacksLanguage && (
                    <span style={{ fontSize: 11, color: "var(--mute)" }}>
                      {t("create.clientMissingLang", { language: language.toUpperCase() })}
                    </span>
                  )}
                </span>
                <LangChips langs={langs} muted={lacksLanguage} />
                {selected && <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--wine)" }} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
