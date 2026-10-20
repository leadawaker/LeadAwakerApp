// Comment-to-DM for one account, agency only: the mode switch, the rules (keyword, post, first
// message), and the log of what was sent, or would have been in dry run. Live conversations are on the
// Chats page under the Instagram type.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { IconBtn } from "@/components/ui/icon-btn";
import { Switch } from "@/components/ui/switch";
import { deleteDmRule, dmLogKey, dmStatusKey, fetchDmLog, fetchDmStatus, updateDmRule, type DmLogView, type DmRuleView } from "../../api/dmApi";
import { DmModeCard } from "./DmModeCard";
import { DmRuleForm } from "./DmRuleForm";

const card: React.CSSProperties = { borderRadius: "var(--r-card)", background: "var(--bone)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 };
const STATUS_COLOR: Record<DmLogView["status"], string> = {
  would_send: "var(--warn)", sending: "var(--mute)", sent: "var(--good)", failed: "hsl(var(--destructive))", skipped: "var(--mute)", received: "var(--wine)",
};

function RuleRow({ accountId, rule, postLabel, onEdit }: { accountId: number; rule: DmRuleView; postLabel: string; onEdit: () => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: dmStatusKey(accountId) });
  const toggle = useMutation({ mutationFn: (active: boolean) => updateDmRule(accountId, rule.id, { active }), onSettled: refresh });
  const remove = useMutation({ mutationFn: () => deleteDmRule(accountId, rule.id), onSettled: refresh });
  return (
    <li className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, opacity: rule.active ? 1 : 0.65 }} data-testid={`dm-rule-${rule.id}`}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Pill color="var(--wine)" tone="solid" style={{ fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>{rule.keyword.toUpperCase()}</Pill>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{postLabel}</span>
        {rule.aiFollowUp && <Pill>{t("comments.aiBadge")}</Pill>}
        <Switch checked={rule.active} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label={t("comments.active")} />
        <IconBtn onClick={onEdit} title={t("comments.edit")} aria-label={t("comments.edit")}><Pencil className="w-4 h-4" /></IconBtn>
        <IconBtn onClick={() => setConfirm(true)} title={t("comments.delete")} aria-label={t("comments.delete")}><Trash2 className="w-4 h-4" /></IconBtn>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{rule.firstMessage}</p>
      {confirm && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)", flex: 1 }}>{t("comments.deleteConfirm")}</span>
          <button type="button" className="la-btn la-btn--wine" disabled={remove.isPending} onClick={() => remove.mutate()}>{t("comments.deleteYes")}</button>
          <button type="button" className="la-btn la-btn--plain" onClick={() => setConfirm(false)}>{t("comments.cancel")}</button>
        </div>
      )}
    </li>
  );
}

export function CommentsSection({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("social");
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DmRuleView | "new" | null>(null);
  const status = useQuery({ queryKey: dmStatusKey(accountId), queryFn: () => fetchDmStatus(accountId), staleTime: 15_000 });
  const log = useQuery({ queryKey: dmLogKey(accountId), queryFn: () => fetchDmLog(accountId), staleTime: 15_000, refetchInterval: 30_000 });
  const when = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

  if (status.isLoading) return <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />;
  if (status.isError || !status.data) return <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t("errors.failed")}</p>;
  const s = status.data;
  const postLabel = (r: DmRuleView) => (r.postId ? s.posts.find((p) => p.id === r.postId)?.caption || `#${r.postId}` : t("comments.allPosts"));
  const done = () => { setEditing(null); qc.invalidateQueries({ queryKey: dmStatusKey(accountId) }); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }} data-testid="comments-section">
      <DmModeCard key={`${s.mode}-${s.hourlyCap}`} accountId={accountId} status={s} />

      <section className="neu-raised" style={card} data-testid="dm-rules">
        <div className="row" style={{ gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{t("comments.rulesTitle")}</h3>
          {!editing && (
            <button type="button" className="la-btn la-btn--wine" onClick={() => setEditing("new")} data-testid="dm-rule-new"><Plus size={12} />{t("comments.newRule")}</button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("comments.rulesHelp")}</p>
        {editing === "new" && <DmRuleForm accountId={accountId} posts={s.posts} onDone={done} />}
        {s.rules.length === 0 && !editing && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("comments.noRules")}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {s.rules.map((r) => (editing !== "new" && editing?.id === r.id
            ? <li key={r.id}><DmRuleForm accountId={accountId} posts={s.posts} rule={r} onDone={done} /></li>
            : <RuleRow key={r.id} accountId={accountId} rule={r} postLabel={postLabel(r)} onEdit={() => setEditing(r)} />))}
        </ul>
      </section>

      <section className="neu-raised" style={card} data-testid="dm-log">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{t("comments.logTitle")}</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--mute)" }}>{t("comments.logHelp")}</p>
        {log.data?.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("comments.logEmpty")}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {(log.data ?? []).map((l) => (
            <li key={l.id} className="neu-inset" style={{ borderRadius: "var(--r-surface)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }} data-testid={`dm-log-${l.id}`}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{when(l.createdAt)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{t(`comments.kinds.${l.kind}`)}</span>
                {l.username && <span style={{ fontSize: 12, color: "var(--mute)" }}>@{l.username}</span>}
                <span style={{ flex: 1 }} />
                {l.mode === "dry_run" && <Pill>{t("comments.modes.dry_run")}</Pill>}
                <Pill color={STATUS_COLOR[l.status]}>{t(`comments.statuses.${l.status}`)}</Pill>
              </div>
              {l.text && <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{l.text}</p>}
              {l.reason && <p style={{ margin: 0, fontSize: 11.5, color: "var(--mute)" }}>{t(`comments.reasons.${l.reason}`, { defaultValue: l.reason })}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
