// Demos > Settings: which prompt each demo runs, set per tile. The chat tiles
// reuse the Prompt section of Chats > Settings on the demo's campaign and save
// only Campaigns.prompt_id, so a pick leaves the campaign's other fields alone.
// The reputation tile has two prompts, saved in Campaigns.prompt_picks by use
// case (the engine's get_prompt_for_campaign).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import type { Campaign } from "@/types/models";
import { ChatPrompt, PromptText } from "@/features/accounts/components/workspace/chat/ChatPrompt";
import { ChatCard, helpStyle, type ChatEdit } from "@/features/accounts/components/workspace/chat/chatAtoms";
import { EditSelect, InfoRow } from "@/features/campaigns/components/formFields";
import { useCampaignById } from "@/features/campaigns/hooks/useCampaignById";
import { campaignPromptResolver, isActivePrompt, isConversationPrompt, promptCampaignOf, promptIdOf, type PromptRowLike } from "@/features/prompts/utils/campaignPrompt";

const LIBRARY_KEY = ["/api/prompts", "demo-prompts"];

function usePromptLibrary() {
  const qc = useQueryClient();
  const query = useQuery<PromptRowLike[]>({
    queryKey: LIBRARY_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/prompts");
      if (!res.ok) throw new Error("Failed to load prompts");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
  });
  return { prompts: query.data ?? [], reload: () => { void qc.invalidateQueries({ queryKey: LIBRARY_KEY }); } };
}

function Loading() {
  return <div className="flex items-center gap-2" style={{ padding: "24px 4px", color: "var(--mute)" }}><Loader2 className="h-4 w-4 animate-spin" /></div>;
}

/** Loads the demo's campaign, then hands it to one of the bodies below. */
function WithCampaign({ campaignId, render }: {
  campaignId: number | null;
  render: (campaign: Campaign, onSave: (id: number, patch: Record<string, unknown>) => Promise<void>) => React.ReactNode;
}) {
  const { t } = useTranslation("demos");
  const { campaign, loading, error, onSave } = useCampaignById(campaignId);
  if (loading) return <Loading />;
  if (error || !campaign) return <p style={helpStyle}>{t("settings.campaign.loadFailed", { id: campaignId })}</p>;
  return <>{render(campaign, onSave)}</>;
}

/** The speed, widget and socials tiles: the conversation prompt their campaign runs. */
export function DemoPromptSettings({ campaignId }: { campaignId: number | null }) {
  return <WithCampaign campaignId={campaignId} render={(campaign, onSave) => <ChatPromptBody campaign={campaign} onSave={onSave} />} />;
}

function ChatPromptBody({ campaign, onSave }: { campaign: Campaign; onSave: (id: number, patch: Record<string, unknown>) => Promise<void> }) {
  const { prompts, reload } = usePromptLibrary();
  const [picked, setPicked] = useState<string | null>(null);
  const linked = useMemo(() => campaignPromptResolver(prompts, [campaign])(campaign.id), [prompts, campaign]);
  const options = useMemo(() => prompts.filter((p) =>
    (isConversationPrompt(p) && isActivePrompt(p)) || (linked && promptIdOf(p) === promptIdOf(linked)),
  ), [prompts, linked]);

  const draft = { prompt_linked_id: picked ?? (linked ? String(promptIdOf(linked)) : "") };
  // ChatPrompt writes to a campaign draft; here the pick is the only field and saves at once.
  const setDraft: ChatEdit["setDraft"] = (update) => {
    const next = typeof update === "function" ? update(draft) : update;
    const id = String(next.prompt_linked_id ?? "");
    setPicked(id);
    void onSave(campaign.id, { prompt_id: Number(id) || null }).catch(() => setPicked(null));
  };

  return (
    <ChatPrompt
      campaign={campaign as unknown as ChatEdit["campaign"]} draft={draft} setDraft={setDraft} canEdit scope="demo"
      prompts={options} linkedPrompt={linked} reloadPrompts={reload}
    />
  );
}

/** The reputation tile: the check-in chat and the review reply, each with its own pick. */
const REPUTATION_PROMPTS = [
  { useCase: "reputation_conversation", key: "conversation", icon: <MessageSquare size={17} /> },
  { useCase: "review-reply", key: "reply", icon: <Star size={17} /> },
] as const;

export function ReputationPromptSettings({ campaignId }: { campaignId: number | null }) {
  return <WithCampaign campaignId={campaignId} render={(campaign, onSave) => <ReputationBody campaign={campaign} onSave={onSave} />} />;
}

function ReputationBody({ campaign, onSave }: { campaign: Campaign; onSave: (id: number, patch: Record<string, unknown>) => Promise<void> }) {
  const { t } = useTranslation("demos");
  const { prompts, reload } = usePromptLibrary();
  const [picks, setPicks] = useState<Record<string, number>>(((campaign as any).prompt_picks ?? {}) as Record<string, number>);

  const pick = (useCase: string, id: number) => {
    const before = picks;
    const next = { ...picks };
    if (id) next[useCase] = id; else delete next[useCase];
    setPicks(next);
    void onSave(campaign.id, { prompt_picks: next }).catch(() => setPicks(before));
  };

  return (
    <>
      {REPUTATION_PROMPTS.map(({ useCase, key, icon }) => {
        const rows = prompts.filter((p) => String(p.useCase ?? p.use_case ?? "") === useCase && isActivePrompt(p));
        const isGlobal = (p: PromptRowLike) => !promptCampaignOf(p) && !(p.accountsId ?? p.Accounts_id);
        // As the engine reads it: the pick, this campaign's own row, then the row all clients share.
        const row = rows.find((p) => promptIdOf(p) === picks[useCase])
          ?? rows.find((p) => promptCampaignOf(p) === campaign.id)
          ?? rows.find(isGlobal) ?? null;
        const labels = Object.fromEntries(rows.map((p) => [String(promptIdOf(p)), `${p.name} · #${promptIdOf(p)}`]));
        return (
          <div key={useCase} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ChatCard icon={icon} title={t(`settings.promptTile.${key}.title`)} testId={`demo-prompt-${key}`}>
              <p style={helpStyle}>{t(`settings.promptTile.${key}.help`)}</p>
              <InfoRow
                label={t("settings.promptTile.inUse")} value={row ? labels[String(promptIdOf(row))] : t("settings.promptTile.builtIn")} noBorder
                editChild={<EditSelect value={row ? String(promptIdOf(row)) : ""} onChange={(v) => pick(useCase, Number(v))} options={Object.keys(labels)} labels={labels} />}
              />
            </ChatCard>
            {row && (
              <PromptText
                key={promptIdOf(row)} row={row} campaign={campaign as unknown as ChatEdit["campaign"]} prompts={rows} canEdit
                scope="demo" useCase={useCase} sharedNote={isGlobal(row) ? t("settings.promptTile.sharedByClients") : undefined}
                onCopied={(id) => { pick(useCase, id); reload(); }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
