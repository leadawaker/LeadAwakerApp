// Chat > Prompt (agency only): the conversation prompt this receptionist runs.
// Switch picks another active chat prompt from the library: it lands in the
// shared draft as prompt_linked_id and saves as Campaigns.prompt_id, the pointer
// the engine reads first. Edits save to the library row itself, so they reach
// every campaign running it (listed under "Also used by"); the text before the
// first edit here is kept as a version. "Make a copy" gives this campaign its
// own row to change alone.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { AlertTriangle, Copy, FileText, Loader2, Repeat } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { fetchCampaigns } from "@/features/campaigns/api/campaignsApi";
import { EditSelect, InfoRow } from "@/features/campaigns/components/formFields";
import { PromptCodeEditor } from "@/features/prompts/components/PromptCodeEditor";
import { campaignsByPrompt, promptIdOf } from "@/features/prompts/utils/campaignPrompt";
import { useAutosave } from "../voice/useAutosave";
import { AutosaveBadge, EDITOR_HEIGHT } from "../voice/SharedPromptCard";
import { PromptVersions, postVersion } from "../voice/PromptVersions";
import { PromptCounts } from "../voice/PromptCounts";
import { ChatCard, helpStyle, type ChatEdit } from "./chatAtoms";

type PromptRow = Record<string, any>;
/** Whose settings these are: a client's account, or a demo tile (Demos > Settings). */
type PromptScope = "account" | "demo";

export function ChatPrompt({ campaign, draft, setDraft, canEdit, prompts, linkedPrompt, reloadPrompts, scope = "account" }: ChatEdit & {
  /** Active conversation prompts plus the linked one (useCampaignDetail). */
  prompts: PromptRow[];
  linkedPrompt: PromptRow | null;
  reloadPrompts: () => void;
  scope?: PromptScope;
}) {
  const { t } = useTranslation("chatTab");
  // The draft holds a fresh pick before its save comes back; show that one.
  const pickedId = Number(draft.prompt_linked_id) || 0;
  const row = prompts.find((p) => promptIdOf(p) === pickedId) ?? (pickedId ? null : linkedPrompt);

  const options = ["", ...prompts.map((p) => String(promptIdOf(p)))];
  const labels: Record<string, string> = { "": t("prompt.none") };
  prompts.forEach((p) => { labels[String(promptIdOf(p))] = `${p.name} · #${promptIdOf(p)}`; });

  return (
    <>
      <ChatCard icon={<Repeat size={17} />} title={t("prompt.pickTitle")} testId="chat-card-prompt-pick">
        <p style={helpStyle}>{t(scope === "demo" ? "prompt.pickHelpDemo" : "prompt.pickHelp")}</p>
        <InfoRow
          label={t("prompt.inUse")} value={row ? labels[String(promptIdOf(row))] ?? row.name : t("prompt.none")} noBorder
          editChild={canEdit ? (
            <EditSelect
              value={row ? String(promptIdOf(row)) : ""}
              onChange={(v) => setDraft((d) => ({ ...d, prompt_linked_id: v }))}
              options={options} labels={labels}
            />
          ) : undefined}
        />
      </ChatCard>
      {row
        ? <PromptText key={promptIdOf(row)} row={row} campaign={campaign} prompts={prompts} canEdit={canEdit} scope={scope}
            onCopied={(id) => { setDraft((d) => ({ ...d, prompt_linked_id: String(id) })); reloadPrompts(); }} />
        : <p style={helpStyle}>{t("prompt.noneHelp")}</p>}
    </>
  );
}

/** One library row, edited in place. Another use case than conversation has no campaigns to list: it says who shares it in sharedNote. */
export function PromptText({ row, campaign, prompts, canEdit, onCopied, scope = "account", useCase = "conversation", sharedNote }: {
  row: PromptRow; campaign: ChatEdit["campaign"]; prompts: PromptRow[]; canEdit: boolean; onCopied: (id: number) => void;
  scope?: PromptScope; useCase?: string; sharedNote?: string;
}) {
  const { t } = useTranslation("chatTab");
  const id = promptIdOf(row);
  const [text, setText] = useState<string>(row.promptText ?? row.prompt_text ?? "");
  const [saved, setSaved] = useState(text);
  const [rev, setRev] = useState(0);
  const [copying, setCopying] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // The text as it was before the first edit here, kept once as a version.
  const snapshotted = useRef(false);

  const save = async (next: string) => {
    if (!snapshotted.current) {
      if (!(await postVersion(id, saved, t("prompt.versionLabel", { campaign: campaign.name ?? "" })))) return false;
      snapshotted.current = true;
    }
    const res = await apiFetch(`/api/prompts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptText: next }),
    }).catch(() => null);
    if (!res?.ok) return false;
    row.promptText = next; // the cached list row, so a switch away and back shows this text
    setSaved(next);
    return true;
  };
  const state = useAutosave(canEdit ? text : saved, saved, save);

  // Every other campaign running this row, resolved as the engine does.
  const campaigns = useQuery<Record<string, any>[]>({ queryKey: ["/api/campaigns", "chat-prompt"], queryFn: () => fetchCampaigns(), staleTime: 30_000, enabled: useCase === "conversation" });
  const others = useCase !== "conversation" ? [] : (campaignsByPrompt(prompts, campaigns.data ?? []).get(id) ?? []).filter((c) => Number(c.id) !== campaign.id);

  const copy = async () => {
    setCopying(true);
    setCopyFailed(false);
    try {
      const res = await apiFetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} · ${campaign.name ?? ""}`.trim(),
          promptText: text,
          systemMessage: row.systemMessage ?? null,
          model: row.model ?? null,
          temperature: row.temperature ?? null,
          maxTokens: row.maxTokens ?? null,
          firstMessage: row.firstMessage ?? null,
          category: row.category ?? null,
          useCase,
          status: "active",
          campaignsId: campaign.id,
          // Off the conversation prompt an account row would run for all that account's reviews.
          accountsId: useCase === "conversation" ? Number(campaign.Accounts_id ?? campaign.accountsId) || null : null,
          isDemo: scope === "demo",
          notes: t("prompt.copyNote", { id }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !promptIdOf(body)) throw new Error();
      onCopied(promptIdOf(body));
    } catch {
      setCopyFailed(true);
    } finally {
      setCopying(false);
    }
  };

  return (
    <ChatCard icon={<FileText size={17} />} title={row.name} action={<AutosaveBadge state={state} />} testId="chat-card-prompt-text">
      {(others.length > 0 || sharedNote) && (
        <div
          className="neu-inset-crisp" data-testid="chat-prompt-shared"
          style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: "var(--r-button)", marginBottom: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}
        >
          <AlertTriangle size={14} style={{ color: "var(--stage-contacted)", flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1 }}>{sharedNote ?? t(scope === "demo" ? "prompt.alsoUsedByDemo" : "prompt.alsoUsedBy", { names: others.map((c) => c.name).join(", ") })}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {canEdit && (others.length > 0 || sharedNote) && (
          <button type="button" className="la-btn la-btn--soft" onClick={() => void copy()} disabled={copying} data-testid="chat-prompt-copy">
            {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}{t(scope === "demo" ? "prompt.copyDemo" : "prompt.copy")}
          </button>
        )}
        <Link href="/platform/prompt-library" onClick={() => { try { localStorage.setItem("prompt-library-initial-id", String(id)); } catch { /* opens unselected */ } }}
          className="la-btn la-btn--soft" data-testid="chat-prompt-library">
          {t("prompt.openLibrary", { id })}
        </Link>
      </div>
      {copyFailed && <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("prompt.copyFailed")}</p>}
      {canEdit && (
        <PromptVersions promptId={id} kind="chat" getText={() => text}
          onRestore={(restored) => { setText(restored); setRev((r) => r + 1); }} />
      )}
      <div className="neu-inset-crisp" style={{ height: EDITOR_HEIGHT, borderRadius: "var(--r-card)", overflow: "hidden" }}>
        <PromptCodeEditor key={`${id}-${rev}`} initialValue={text} fontSize={13} onChange={canEdit ? setText : () => {}} />
      </div>
      <PromptCounts text={text} />
    </ChatCard>
  );
}
