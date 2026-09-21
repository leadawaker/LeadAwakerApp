import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, Upload } from "lucide-react";
import { API_BASE } from "@/lib/apiUtils";
import { useSetClientScreenshot } from "../../api/demoClientsApi";

/**
 * The homepage image the widget demo shows behind the chat bubble.
 *
 * A Client built from a URL gets one from the scrape. A Client typed as a
 * niche never had a site to photograph, so its widget demo had nothing behind
 * it: this is how one gets there by hand, a generated mockup or a screenshot.
 * Either way it is stored as the same .webp a scrape produces, so the demo
 * page, the sessions thumbnail and the launcher colour all treat it the same.
 */

/** Well under the route's ceiling, and past any real screenshot. */
const MAX_BYTES = 8_000_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

export function ClientScreenshot({ niche, screenshot }: { niche: string; screenshot: string | null }) {
  const { t } = useTranslation("campaigns");
  const save = useSetClientScreenshot(niche);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("clients.shot.tooLarge", "That image is too large."));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      // Sent as it is: the server converts PNG and JPEG to webp, so there is
      // no canvas step here to quietly re-encode a clean mockup twice.
      await save.mutateAsync(await readAsDataUrl(file));
    } catch (err) {
      setError(err instanceof Error && err.message !== "read" ? err.message : t("clients.shot.failed", "Upload failed."));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
      <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.shot.title", "Website image")}</div>
      <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
        {t("clients.shot.hint", "The page the widget demo sits on. Uploaded by hand for a Client with no website of its own.")}
      </p>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            width: 220,
            height: 124,
            borderRadius: "var(--r-surface)",
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--card)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {screenshot ? (
            <img
              src={`${API_BASE}/api/site-shot/${screenshot}`}
              alt={t("clients.shot.title", "Website image")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "var(--mute-2)" }}>{t("clients.shot.none", "No image yet")}</span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="la-btn la-btn--soft"
            disabled={save.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {screenshot ? t("clients.shot.replace", "Replace") : t("clients.shot.upload", "Upload")}
          </button>
          {screenshot && (
            <button
              type="button"
              className="la-btn la-btn--soft"
              disabled={save.isPending}
              onClick={() => void save.mutateAsync(null).catch(() => setError(t("clients.shot.failed", "Upload failed.")))}
            >
              <Trash2 size={13} />
              {t("clients.shot.remove", "Remove")}
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</p>}
    </section>
  );
}
