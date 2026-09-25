// The Client's logo for the Instagram and Reputation demos, set from the Demos
// table. One logo per Client, read live by the demo pages, so the switch and
// any replacement reach every demo of that Client at once.
//
// Fetched from the Client's website when it is scraped; this is where it is
// previewed, switched off, re-fetched, or replaced with an upload.
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { businessInitials } from "@/lib/businessInitials";
import { apiAsset } from "../api/demoSettingsApi";
import {
  useClientLogos,
  useFetchClientLogo,
  useSetClientLogoEnabled,
  useUploadClientLogo,
} from "../api/demoLogosApi";

// The Instagram ring gradient, so the fallback preview matches the demo.
const RING = "linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)";
const MAX_UPLOAD = 3_000_000;

/** One circle exactly as a visitor sees it: logo when on, initials otherwise. */
function Avatar({ logo, name, size }: { logo: string | null; name: string; size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.38),
        background: logo ? "#fff" : RING,
        boxShadow: logo ? "inset 0 0 0 1px rgba(0,0,0,.12)" : undefined,
      }}
    >
      {logo ? <img src={apiAsset(logo)} alt="" className="h-full w-full object-cover" /> : businessInitials(name)}
    </span>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

export function ClientLogoSwatch({ niche }: { niche: string }) {
  const { t } = useTranslation("demos");
  const { data } = useClientLogos();
  const fetchLogo = useFetchClientLogo(niche);
  const upload = useUploadClientLogo(niche);
  const setEnabled = useSetClientLogoEnabled(niche);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const entry = data?.[niche];
  const name = entry?.company || niche;
  const stored = entry?.logoUrl || null;
  const enabled = entry?.enabled !== false;
  const shown = stored && enabled ? stored : null;
  const busy = fetchLogo.isPending || upload.isPending || setEnabled.isPending;

  const run = (p: Promise<unknown>) => {
    setError("");
    p.catch((e: Error) => setError(e.message));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD) { setError(t("clientLogo.tooLarge")); return; }
    try {
      run(upload.mutateAsync(await readAsDataUrl(file)));
    } catch {
      setError(t("clientLogo.unreadable"));
    }
  };

  const btn = "rounded border px-2 py-1 text-[11.5px] hover:bg-muted disabled:opacity-40";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("clientLogo.title")}
          aria-label={t("clientLogo.title")}
          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--mute-2)" }} /> : <Avatar logo={shown} name={name} size={15} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-3">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{t("clientLogo.title")}</div>
        <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 2, marginBottom: 10 }}>{t("clientLogo.hint")}</div>

        <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
          <Avatar logo={shown} name={name} size={56} />
          <Avatar logo={shown} name={name} size={32} />
          <Avatar logo={shown} name={name} size={24} />
          <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("clientLogo.preview")}</span>
        </div>

        <label className="flex items-center justify-between gap-2" style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
          <span>{t("clientLogo.show")}</span>
          <Switch
            checked={enabled && !!stored}
            disabled={!stored || busy}
            onCheckedChange={(v) => run(setEnabled.mutateAsync(v))}
          />
        </label>
        <div style={{ fontSize: 10.5, color: "var(--mute-2)", marginTop: 4 }}>
          {!stored ? t("clientLogo.none") : entry?.source === "upload" ? t("clientLogo.fromUpload") : t("clientLogo.fromSite")}
        </div>

        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
          <button
            type="button"
            className={btn}
            disabled={busy || !entry?.websiteUrl}
            title={entry?.websiteUrl ? entry.websiteUrl : t("clientLogo.noWebsite")}
            onClick={() => run(fetchLogo.mutateAsync())}
          >
            {t("clientLogo.fetch")}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
            {t("clientLogo.upload")}
          </button>
          {stored && (
            <button type="button" className={btn} disabled={busy} onClick={() => run(upload.mutateAsync(null))}>
              {t("clientLogo.remove")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
        {error && <div className="text-destructive" style={{ fontSize: 11, marginTop: 8 }}>{error}</div>}
      </PopoverContent>
    </Popover>
  );
}
