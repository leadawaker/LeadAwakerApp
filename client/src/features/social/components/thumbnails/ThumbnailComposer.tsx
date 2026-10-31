// The thumbnail form: what it is for (a script, a post, or nothing), the title, the look (auto, Mia on
// the cover, title only, collage, or a saved style), the format (Reel 9:16 by default), the reference
// images, extra instructions and how many variants. "Make it for me" lets the model pick the look.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Loader2, Save, Sparkles, Type, User, Wand2 } from "lucide-react";
import { THUMB_FORMATS, THUMB_KINDS, THUMB_LIMITS, type ThumbKind } from "@shared/socialThumbnails";
import { cn } from "@/lib/utils";
import { fetchSocialPosts, SocialApiError, socialPostsKey } from "../../api/socialApi";
import { fetchScripts, socialScriptsKey } from "../../api/studioApi";
import {
  createThumbnailStyle,
  deleteThumbnailStyle,
  generateThumbnails,
  thumbnailStylesKey,
  thumbnailsKey,
  type GenerateInput,
  type RefView,
  type StyleView,
  type ThumbnailView,
} from "../../api/thumbnailsApi";
import { applyStyle, makeItForMe, parseSource, thumbErrorKey, toGenerateInput, toggleRef, type ComposerForm } from "../../lib/thumbnails";
import { ReferencePicker } from "./ReferencePicker";
import { StyleChip } from "./StyleChip";
import { TitleSuggestions } from "./TitleSuggestions";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };
const errStyle: React.CSSProperties = { margin: 0, fontSize: 12, color: "hsl(var(--destructive))" };
const KIND_ICON: Record<ThumbKind, typeof Sparkles> = { auto: Sparkles, presenter: User, title: Type, collage: LayoutGrid };

export function ThumbnailComposer({ accountId, form, setForm, refs, styles, configured }: {
  accountId: number;
  form: ComposerForm;
  setForm: (next: ComposerForm) => void;
  refs: RefView[];
  styles: StyleView[];
  configured: boolean;
}) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [styleName, setStyleName] = useState<string | null>(null);
  const scripts = useQuery({ queryKey: socialScriptsKey(accountId), queryFn: () => fetchScripts(accountId), staleTime: 30_000 });
  const posts = useQuery({ queryKey: socialPostsKey(accountId), queryFn: () => fetchSocialPosts(accountId), staleTime: 30_000 });
  const set = (patch: Partial<ComposerForm>) => setForm({ ...form, ...patch });

  const run = useMutation({
    mutationFn: (input: GenerateInput) => generateThumbnails(accountId, input),
    onSuccess: (rows) => {
      qc.setQueryData<ThumbnailView[]>(thumbnailsKey(accountId), (old) => [...rows, ...(old ?? [])]);
    },
  });
  const saveStyle = useMutation({
    mutationFn: (name: string) => createThumbnailStyle(accountId, { name, kind: form.kind, prompt: form.prompt.trim(), format: form.format, refIds: form.refIds }),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: thumbnailStylesKey(accountId) }); setStyleName(null); set({ styleId: s.id }); },
  });
  const dropStyle = useMutation({
    mutationFn: (id: number) => deleteThumbnailStyle(accountId, id),
    onSuccess: (_r, id) => { qc.invalidateQueries({ queryKey: thumbnailStylesKey(accountId) }); if (form.styleId === id) set({ styleId: null }); },
  });

  // Picking a script or a post fills an empty title from it.
  const pickSource = (source: string) => {
    const { scriptId } = parseSource(source);
    const script = scriptId ? scripts.data?.find((s) => s.id === scriptId) : null;
    set({ source, title: form.title.trim() || !script ? form.title : script.title.slice(0, THUMB_LIMITS.title) });
  };

  const sourceOptions = useMemo(() => {
    const s = (scripts.data ?? []).map((x) => ({ value: `script:${x.id}`, label: x.title }));
    const p = (posts.data ?? []).filter((x) => x.caption.trim()).map((x) => ({ value: `post:${x.id}`, label: x.caption.trim().split("\n")[0].slice(0, 80) }));
    return { scripts: s, posts: p };
  }, [scripts.data, posts.data]);

  const busy = run.isPending;
  const reason = run.error instanceof SocialApiError ? run.error.reason : run.error ? "failed" : null;
  const people = refs.filter((r) => r.kind === "person").length;
  // The look the second button uses: the applied saved style, else the picked look.
  const look = styles.find((x) => x.id === form.styleId)?.name ?? t(`thumbnails.kinds.${form.kind}.name`);

  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }} data-testid="thumb-composer">
      <div>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t("thumbnails.composer.title")}</h3>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--mute)" }}>{t("thumbnails.composer.help")}</p>
      </div>

      {!configured && (
        <p className="neu-inset-crisp" style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--r-flush)", fontSize: 12, color: "var(--ink-soft)" }} data-testid="thumb-not-configured">
          {t("thumbnails.notConfigured")}
        </p>
      )}

      <div>
        <label style={labelStyle} htmlFor="thumb-source">{t("thumbnails.composer.source")}</label>
        <select id="thumb-source" className="neu-input" value={form.source} onChange={(e) => pickSource(e.target.value)} style={{ fontSize: 13, padding: "8px 11px", width: "100%" }} data-testid="thumb-source">
          <option value="">{t("thumbnails.composer.sourceNone")}</option>
          {sourceOptions.scripts.length > 0 && (
            <optgroup label={t("thumbnails.composer.sourceScripts")}>
              {sourceOptions.scripts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          )}
          {sourceOptions.posts.length > 0 && (
            <optgroup label={t("thumbnails.composer.sourcePosts")}>
              {sourceOptions.posts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor="thumb-title">{t("thumbnails.composer.titleLabel")}</label>
        <input id="thumb-title" className="neu-input" value={form.title} maxLength={THUMB_LIMITS.title} onChange={(e) => set({ title: e.target.value })}
          placeholder={t("thumbnails.composer.titlePlaceholder")} style={{ fontSize: 13, padding: "8px 11px", width: "100%" }} data-testid="thumb-title" />
        <TitleSuggestions accountId={accountId} form={form} onPick={(title) => set({ title: title.slice(0, THUMB_LIMITS.title) })} />
      </div>

      <div>
        <span style={labelStyle}>{t("thumbnails.composer.look")}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {THUMB_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const on = form.kind === k && form.styleId === null;
            return (
              <button key={k} type="button" onClick={() => set({ kind: k, styleId: null })} aria-pressed={on}
                className={on ? "neu-inset-crisp" : "neu-raised"}
                style={{ borderRadius: "var(--r-surface)", padding: "9px 10px", textAlign: "left", display: "flex", flexDirection: "column", gap: 3, cursor: "pointer",
                  border: on ? "1px solid var(--wine)" : "1px solid transparent", background: "var(--bone)" }}
                data-testid={`thumb-kind-${k}`}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: on ? "var(--wine)" : "var(--ink-soft)" }}>
                  <Icon size={13} />{t(`thumbnails.kinds.${k}.name`)}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--mute)", lineHeight: 1.35 }}>{t(`thumbnails.kinds.${k}.help`)}</span>
              </button>
            );
          })}
        </div>
        {form.kind === "presenter" && people === 0 && <p style={{ ...errStyle, color: "var(--mute)", marginTop: 6, fontSize: 11.5 }}>{t("thumbnails.composer.needPerson")}</p>}
      </div>

      {styles.length > 0 && (
        <div>
          <span style={labelStyle}>{t("thumbnails.styles.title")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {styles.map((s) => (
              <StyleChip key={s.id} style={s} active={form.styleId === s.id} deleting={dropStyle.isPending} onApply={() => setForm(applyStyle(form, s))} onDelete={() => dropStyle.mutate(s.id)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <span style={labelStyle}>{t("thumbnails.composer.format")}</span>
        <div className="la-seg la-seg--pill" role="radiogroup" aria-label={t("thumbnails.composer.format")} style={{ flexWrap: "wrap" }}>
          {THUMB_FORMATS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={form.format === f} className={cn("la-seg-btn", form.format === f && "on")} onClick={() => set({ format: f })} data-testid={`thumb-format-${f}`}>
              {t(`thumbnails.formats.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={labelStyle}>{t("thumbnails.refs.title")}</span>
        <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--mute)" }}>{t("thumbnails.refs.pickHelp", { max: THUMB_LIMITS.refsPerRequest })}</p>
        <ReferencePicker accountId={accountId} refs={refs} selected={form.refIds} canEdit onToggle={(id) => set({ refIds: toggleRef(form.refIds, id) })} />
      </div>

      <div>
        <label style={labelStyle} htmlFor="thumb-prompt">{t("thumbnails.composer.prompt")}</label>
        <textarea id="thumb-prompt" className="neu-input" rows={3} value={form.prompt} maxLength={THUMB_LIMITS.prompt} onChange={(e) => set({ prompt: e.target.value })}
          placeholder={t("thumbnails.composer.promptPlaceholder")} style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 12px", width: "100%", resize: "vertical" }} data-testid="thumb-prompt" />
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>{t("thumbnails.composer.variants")}</span>
        <div className="la-seg la-seg--pill" role="radiogroup" aria-label={t("thumbnails.composer.variants")}>
          {Array.from({ length: THUMB_LIMITS.variants }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={form.variants === n} className={cn("la-seg-btn", form.variants === n && "on")} onClick={() => set({ variants: n })}>{n}</button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="la-btn la-btn--wine" disabled={!configured || busy} onClick={() => run.mutate(makeItForMe(form))} data-testid="thumb-make-for-me">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}{t("thumbnails.composer.makeForMe")}
        </button>
        <button type="button" className="la-btn la-btn--soft" disabled={!configured || busy} onClick={() => run.mutate(toGenerateInput(form))} data-testid="thumb-generate">
          <Sparkles size={12} />{t("thumbnails.composer.generate", { look })}
        </button>
        {styleName === null ? (
          <button type="button" className="la-btn la-btn--plain" onClick={() => setStyleName("")} data-testid="thumb-save-style">
            <Save size={12} />{t("thumbnails.styles.save")}
          </button>
        ) : (
          <span className="row" style={{ gap: 6 }}>
            <input className="neu-input" autoFocus value={styleName} maxLength={THUMB_LIMITS.styleName} onChange={(e) => setStyleName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && styleName.trim()) saveStyle.mutate(styleName.trim()); if (e.key === "Escape") setStyleName(null); }}
              placeholder={t("thumbnails.styles.namePlaceholder")} style={{ fontSize: 12.5, padding: "6px 10px", width: 170 }} data-testid="thumb-style-name" />
            <button type="button" className="la-btn la-btn--wine" disabled={!styleName.trim() || saveStyle.isPending} onClick={() => saveStyle.mutate(styleName.trim())}>
              {saveStyle.isPending && <Loader2 size={12} className="animate-spin" />}{t("thumbnails.styles.saveConfirm")}
            </button>
            <button type="button" className="la-btn la-btn--plain" onClick={() => setStyleName(null)}>{t("thumbnails.styles.cancel")}</button>
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--mute)" }}>{t("thumbnails.composer.makeForMeHelp")}</p>
      {reason && <p role="alert" style={errStyle} data-testid="thumb-error">{t(thumbErrorKey(reason))}</p>}
      {(saveStyle.error || dropStyle.error) && <p role="alert" style={errStyle}>{t(thumbErrorKey((saveStyle.error ?? dropStyle.error) instanceof SocialApiError ? ((saveStyle.error ?? dropStyle.error) as SocialApiError).reason : "failed"))}</p>}
    </section>
  );
}
