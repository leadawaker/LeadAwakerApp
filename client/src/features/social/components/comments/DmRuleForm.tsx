// New / edit a comment-to-DM rule, inline (no dialog): keyword, which post (one published post or all),
// the first message ({username} is filled in), and the AI follow-up flag.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SocialApiError } from "../../api/socialApi";
import { createDmRule, updateDmRule, type DmRuleView, type DmStatus, type RuleBody } from "../../api/dmApi";
import { studioErrorKey } from "../../lib/studio";

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 3, display: "block" };

export function DmRuleForm({ accountId, posts, rule, onDone }: { accountId: number; posts: DmStatus["posts"]; rule?: DmRuleView; onDone: () => void }) {
  const { t } = useTranslation("social");
  const [form, setForm] = useState<RuleBody>({
    keyword: rule?.keyword ?? "", firstMessage: rule?.firstMessage ?? t("comments.defaultMessage"), postId: rule?.postId ?? null, aiFollowUp: rule?.aiFollowUp ?? false,
  });
  // An edit sends only what changed: a rule whose post is no longer live can still get a new message.
  const changes = (): Partial<RuleBody> => {
    if (!rule) return form;
    const out: Partial<RuleBody> = {};
    if (form.keyword !== rule.keyword) out.keyword = form.keyword;
    if (form.firstMessage !== rule.firstMessage) out.firstMessage = form.firstMessage;
    if (form.postId !== rule.postId) out.postId = form.postId;
    if (form.aiFollowUp !== rule.aiFollowUp) out.aiFollowUp = form.aiFollowUp;
    return out;
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!rule) return createDmRule(accountId, form);
      const body = changes();
      return Object.keys(body).length ? updateDmRule(accountId, rule.id, body) : rule;
    },
    onSuccess: onDone,
  });
  const missingPost = rule?.postId != null && !posts.some((p) => p.id === rule.postId);
  const reason = save.error instanceof SocialApiError ? save.error.reason : save.error ? "failed" : null;
  // One word (letters and digits, punctuation at the end is fine): the server refuses anything else.
  const valid = /^[\p{L}\p{M}\p{N}]+[!?.,]*$/u.test(form.keyword.trim()) && form.keyword.trim().length <= 30 && form.firstMessage.trim().length > 0 && form.firstMessage.length <= 1000;

  return (
    <form className="neu-inset-crisp" style={{ borderRadius: "var(--r-surface)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}
      onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }} data-testid="dm-rule-form">
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "0 1 180px", minWidth: 140 }}>
          <label style={labelStyle} htmlFor="dm-keyword">{t("comments.keyword")}</label>
          <input id="dm-keyword" className="neu-input" value={form.keyword} maxLength={30} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="GUIA"
            style={{ fontSize: 13, padding: "6px 10px", width: "100%", textTransform: "uppercase" }} data-testid="dm-keyword" />
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <label style={labelStyle} htmlFor="dm-post">{t("comments.post")}</label>
          <select id="dm-post" className="neu-input" value={form.postId ?? ""} onChange={(e) => setForm({ ...form, postId: e.target.value ? Number(e.target.value) : null })}
            style={{ fontSize: 12.5, padding: "6px 10px", width: "100%" }} data-testid="dm-post">
            <option value="">{t("comments.allPosts")}</option>
            {missingPost && <option value={rule!.postId!}>{t("comments.postGone", { id: rule!.postId })}</option>}
            {posts.map((p) => <option key={p.id} value={p.id}>{p.caption || `#${p.id}`}</option>)}
          </select>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--mute)" }}>{t("comments.keywordHelp")}</p>
      <div>
        <label style={labelStyle} htmlFor="dm-first">{t("comments.firstMessage")}</label>
        <textarea id="dm-first" className="neu-input" rows={3} maxLength={1000} value={form.firstMessage} onChange={(e) => setForm({ ...form, firstMessage: e.target.value })}
          style={{ fontSize: 13, padding: "6px 10px", width: "100%", resize: "vertical" }} data-testid="dm-first" />
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--mute)" }}>{t("comments.firstMessageHelp")}</p>
      </div>
      <label className="row" style={{ gap: 12, cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{t("comments.aiFollowUp")}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--mute)" }}>{t("comments.aiFollowUpHelp")}</span>
        </span>
        <Switch checked={form.aiFollowUp} onCheckedChange={(v) => setForm({ ...form, aiFollowUp: v })} data-testid="dm-ai" />
      </label>
      {reason && <p role="alert" style={{ margin: 0, fontSize: 12, color: "hsl(var(--destructive))" }}>{t(studioErrorKey(reason))}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="la-btn la-btn--wine" disabled={!valid || save.isPending} data-testid="dm-rule-save">
          {save.isPending && <Loader2 size={12} className="animate-spin" />}{t(rule ? "comments.saveRule" : "comments.addRule")}
        </button>
        <button type="button" className="la-btn la-btn--plain" onClick={onDone}>{t("comments.cancel")}</button>
      </div>
    </form>
  );
}
