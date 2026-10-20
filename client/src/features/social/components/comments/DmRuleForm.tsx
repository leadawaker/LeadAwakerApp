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

const labelStyle: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 5, display: "block" };

export function DmRuleForm({ accountId, posts, rule, onDone }: { accountId: number; posts: DmStatus["posts"]; rule?: DmRuleView; onDone: () => void }) {
  const { t } = useTranslation("social");
  const [form, setForm] = useState<RuleBody>({
    keyword: rule?.keyword ?? "", firstMessage: rule?.firstMessage ?? t("comments.defaultMessage"), postId: rule?.postId ?? null, aiFollowUp: rule?.aiFollowUp ?? false,
  });
  const save = useMutation({ mutationFn: () => (rule ? updateDmRule(accountId, rule.id, form) : createDmRule(accountId, form)), onSuccess: onDone });
  const reason = save.error instanceof SocialApiError ? save.error.reason : save.error ? "failed" : null;
  const valid = /[\p{L}\p{N}]/u.test(form.keyword) && form.keyword.trim().length <= 30 && form.firstMessage.trim().length > 0 && form.firstMessage.length <= 1000;

  return (
    <form className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}
      onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }} data-testid="dm-rule-form">
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "0 1 180px", minWidth: 140 }}>
          <label style={labelStyle} htmlFor="dm-keyword">{t("comments.keyword")}</label>
          <input id="dm-keyword" className="neu-input" value={form.keyword} maxLength={30} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="GUIA"
            style={{ fontSize: 13, padding: "8px 11px", width: "100%", textTransform: "uppercase" }} data-testid="dm-keyword" />
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <label style={labelStyle} htmlFor="dm-post">{t("comments.post")}</label>
          <select id="dm-post" className="neu-input" value={form.postId ?? ""} onChange={(e) => setForm({ ...form, postId: e.target.value ? Number(e.target.value) : null })}
            style={{ fontSize: 12.5, padding: "8px 11px", width: "100%" }} data-testid="dm-post">
            <option value="">{t("comments.allPosts")}</option>
            {posts.map((p) => <option key={p.id} value={p.id}>{p.caption || `#${p.id}`}</option>)}
          </select>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t("comments.keywordHelp")}</p>
      <div>
        <label style={labelStyle} htmlFor="dm-first">{t("comments.firstMessage")}</label>
        <textarea id="dm-first" className="neu-input" rows={4} maxLength={1000} value={form.firstMessage} onChange={(e) => setForm({ ...form, firstMessage: e.target.value })}
          style={{ fontSize: 13, padding: "8px 11px", width: "100%", resize: "vertical" }} data-testid="dm-first" />
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
