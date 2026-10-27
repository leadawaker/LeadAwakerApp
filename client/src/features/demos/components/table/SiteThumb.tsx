import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiAsset } from "../../api/demoSettingsApi";
import type { ProspectRow } from "../../prospectRows";

/** Only a web address is offered as a link: the URL is typed in by a person, so a `javascript:` one must not reach an href. */
function liveUrl(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

/**
 * The prospect's homepage, captured when the demo was built from their URL.
 * A list of names all looks alike; a list of sites does not. Click for a larger
 * screenshot and a link to the live site. Rows without one get a neutral block so
 * every row keeps its height and the column stays aligned.
 */
export function SiteThumb({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  if (!row.screenshot) {
    return (
      <div
        className="h-9 w-14 rounded border max-md:h-11"
        style={{ borderColor: "var(--line)", background: "var(--paper)" }}
        aria-hidden
      />
    );
  }

  const src = apiAsset(`/api/site-shot/${row.screenshot}`);
  const live = liveUrl(row.websiteUrl);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("site.preview")}
          aria-label={t("site.preview")}
          className="block h-9 w-14 overflow-hidden rounded border max-md:h-11"
          style={{ borderColor: "var(--line)" }}
        >
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[min(520px,calc(100vw-32px))] flex-col gap-2 p-2">
        <img src={src} alt={row.companyName || t("site.preview")} className="w-full rounded-[var(--r-button)] border object-cover object-top" style={{ borderColor: "var(--line)" }} />
        {live && (
          <a
            href={live}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-[var(--r-button)] px-1 py-1 hover:underline max-md:min-h-11"
            style={{ fontSize: 12.5, color: "var(--wine)" }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("site.openLive")}
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
