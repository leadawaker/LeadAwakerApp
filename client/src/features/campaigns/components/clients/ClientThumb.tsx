import { useState } from "react";
import { Building2 } from "lucide-react";
import { API_BASE } from "@/lib/apiUtils";
import { thumbInitial, thumbSources } from "./personaThumb";
import type { DemoClientSummary } from "../../api/demoClientsApi";

/**
 * A row's picture: the persona's logo, else a screenshot of its website, else the
 * first letter of its name. The files are the ones the editor already serves
 * (/api/site-shot/). Lazy, and a file that fails to load steps down to the next
 * choice rather than leaving a broken-image icon in the list.
 */
export function ClientThumb({ client, name }: { client: Pick<DemoClientSummary, "logo" | "screenshot">; name: string }) {
  const sources = thumbSources(client);
  // How many choices have failed. The caller keys this component by its files, so new files start over.
  const [failed, setFailed] = useState(0);
  const shown = sources[failed];

  return (
    <span className={`dp-thumb-box${shown ? ` dp-thumb-box--${shown.kind}` : ""}`} aria-hidden>
      {shown ? (
        <img
          key={shown.file}
          src={`${API_BASE}/api/site-shot/${shown.file}`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed((n) => n + 1)}
        />
      ) : thumbInitial(name) ? (
        <span className="dp-thumb-initial">{thumbInitial(name)}</span>
      ) : (
        <Building2 className="h-5 w-5" />
      )}
    </span>
  );
}
