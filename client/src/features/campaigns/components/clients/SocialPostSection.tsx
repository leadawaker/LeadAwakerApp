import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, RefreshCw, Save } from "lucide-react";
import { API_BASE } from "@/lib/apiUtils";
import {
  CLIENTS_KEY,
  type DemoLang,
  type SocialPostEdit,
  type SocialPostFields,
  useRegenerateSocialPost,
  useSaveSocialPost,
} from "../../api/demoClientsApi";

const LANGS: DemoLang[] = ["en", "nl", "pt"];
const EMPTY: SocialPostEdit = { caption: "", keyword: "", cta_line: "", dm_opener: "" };

/**
 * A Client's Instagram post (specs/social-reply-demo): the caption, comment
 * keyword, comment CTA and first DM the Socials demo is built around, plus
 * the generated photo it sits under. Own Save button rather than the editor's
 * autosave draft, so a half-typed keyword never reaches the server validator
 * mid-word.
 */
export function SocialPostSection({
  niche,
  socialPost,
  socialImage,
}: {
  niche: string;
  socialPost: Partial<Record<DemoLang, SocialPostFields>> | null;
  socialImage: string | null;
}) {
  const { t } = useTranslation("campaigns");
  const qc = useQueryClient();
  const save = useSaveSocialPost(niche);
  const regen = useRegenerateSocialPost(niche);
  const [lang, setLang] = useState<DemoLang>("en");
  const current = socialPost?.[lang] ?? null;
  const [draft, setDraft] = useState<SocialPostEdit>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setDraft(current ? { caption: current.caption, keyword: current.keyword, cta_line: current.cta_line, dm_opener: current.dm_opener } : EMPTY);
    setError(null);
  }, [lang, current?.caption, current?.keyword, current?.cta_line, current?.dm_opener]);

  // After "Regenerate image" the server answers 202 and works in the background:
  // refetch every 5s until the file name changes, for at most 2 minutes.
  useEffect(() => {
    if (waitingFor === undefined) return;
    if (socialImage !== waitingFor) { setWaitingFor(undefined); return; }
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 120_000) { clearInterval(id); setWaitingFor(undefined); return; }
      qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, niche] });
    }, 5000);
    return () => clearInterval(id);
  }, [waitingFor, socialImage, niche, qc]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : t("clients.social.failed", "Something went wrong.")); }
  };

  const dirty = current !== null && (Object.keys(EMPTY) as (keyof SocialPostEdit)[]).some((k) => draft[k] !== current[k]);
  const busy = save.isPending || regen.isPending;

  const field = (key: keyof SocialPostEdit, label: string, rows: number, help?: string) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginBottom: 4 }}>{label}</span>
      <textarea
        className="la-input"
        rows={rows}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        style={{ width: "100%", resize: "vertical" }}
      />
      {help && <span style={{ display: "block", fontSize: 11, color: "var(--mute-2)", marginTop: 4 }}>{help}</span>}
    </label>
  );

  return (
    <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
      <div className="eyebrow wine" style={{ marginBottom: 4 }}>{t("clients.social.title", "Instagram post")}</div>
      <p style={{ fontSize: 12, color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
        {t("clients.social.hint", "The post the Instagram demo is built around. Written the first time a Socials link is minted in a language.")}
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 160, height: 160, borderRadius: "var(--r-surface)", overflow: "hidden", flexShrink: 0, background: "var(--card)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {socialImage ? (
            <img src={`${API_BASE}/api/site-shot/${socialImage}`} alt={t("clients.social.title", "Instagram post")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 12, color: "var(--mute-2)", textAlign: "center", padding: 8 }}>
              {waitingFor !== undefined ? t("clients.social.imagePending", "Generating the image...") : t("clients.social.noImage", "No image yet")}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {LANGS.map((l) => (
              <button key={l} type="button" className={`la-btn ${l === lang ? "la-btn--wine" : "la-btn--soft"}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {current ? (
            <>
              {field("caption", t("clients.social.caption", "Caption"), 3)}
              {field("keyword", t("clients.social.keyword", "Comment word"), 1)}
              {field("cta_line", t("clients.social.cta", "Comment line under the post"), 2)}
              {field("dm_opener", t("clients.social.opener", "First DM"), 2, t("clients.social.openerHelp", "Keep {agent_name} and {company_name} in the text."))}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--mute)", marginBottom: 12 }}>
              {t("clients.social.none", "No Instagram post in this language yet.")}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {current && (
              <button type="button" className="la-btn la-btn--soft" disabled={!dirty || busy}
                onClick={() => void run(() => save.mutateAsync({ language: lang, post: draft }))}>
                {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {t("clients.social.save", "Save")}
              </button>
            )}
            <button type="button" className="la-btn la-btn--soft" disabled={busy}
              onClick={() => void run(() => regen.mutateAsync({ language: lang, part: "text" }))}>
              {regen.isPending && regen.variables?.part === "text" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {current ? t("clients.social.regenerateText", "Rewrite text") : t("clients.social.writeNow", "Write it now")}
            </button>
            {current && (
              <button type="button" className="la-btn la-btn--soft" disabled={busy || waitingFor !== undefined}
                onClick={() => void run(async () => { await regen.mutateAsync({ language: lang, part: "image" }); setWaitingFor(socialImage); })}>
                <ImageIcon size={13} />
                {t("clients.social.regenerateImage", "New image")}
              </button>
            )}
          </div>
          {error && <p style={{ marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>{error}</p>}
        </div>
      </div>
    </section>
  );
}
