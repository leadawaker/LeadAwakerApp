// Scripts: working drafts, in the card style. "+ New script" is the primary action here; a script comes
// from an idea ("Make a script") or starts blank from a title.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { GroupHeader } from "@/components/crm/primitives";
import { createScript, fetchScripts, socialScriptsKey } from "../../api/studioApi";
import { groupScripts } from "../../lib/studio";
import { ScriptCard } from "./ScriptCard";

function NewScript({ accountId, onCreated }: { accountId: number; onCreated: (id: number) => void }) {
  const { t } = useTranslation("social");
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const make = useMutation({
    mutationFn: () => createScript(accountId, { title: title.trim() }),
    onSuccess: (s) => { setTitle(""); qc.invalidateQueries({ queryKey: socialScriptsKey(accountId) }); onCreated(s.id); },
  });
  return (
    <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) make.mutate(); }}>
      <input className="neu-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t("scripts.newTitlePlaceholder")} aria-label={t("scripts.newTitlePlaceholder")}
        style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: "8px 11px" }} data-testid="script-new-title" />
      <button type="submit" className="la-btn la-btn--wine" disabled={!title.trim() || make.isPending} data-testid="script-new">
        {make.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}{t("scripts.new")}
      </button>
    </form>
  );
}

export function ScriptsPanel({ accountId, selectedId, onSelect }: { accountId: number; selectedId: number | null; onSelect: (id: number) => void }) {
  const { t } = useTranslation("social");
  const scripts = useQuery({ queryKey: socialScriptsKey(accountId), queryFn: () => fetchScripts(accountId), staleTime: 15_000 });
  return (
    <section className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }} data-testid="studio-scripts">
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{t("scripts.title")}</h3>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--mute)" }}>{t("scripts.help")}</p>
      </div>
      <NewScript accountId={accountId} onCreated={onSelect} />
      {scripts.isLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />}
      {scripts.data && scripts.data.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("scripts.empty")}</p>}
      {groupScripts(scripts.data ?? []).map((g) => (
        <div key={g.status} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <GroupHeader label={t(`scripts.statuses.${g.status}`)} count={g.scripts.length} sticky={false} />
          {g.scripts.map((s) => <ScriptCard key={s.id} accountId={accountId} script={s} selected={s.id === selectedId} onSelect={() => onSelect(s.id)} />)}
        </div>
      ))}
    </section>
  );
}
