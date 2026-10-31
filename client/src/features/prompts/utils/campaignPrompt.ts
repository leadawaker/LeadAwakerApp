// Which conversation prompt each campaign runs, resolved the way the engine does
// (automations tools/db/prompts.py get_prompt_for_campaign): the picked prompt
// (Campaigns.prompt_id) when that row is active, else the campaign's own newest
// active conversation row, else the same for the campaign it borrows from
// (prompt_campaign_id). Used by Chats > Settings > Prompt and the Prompts list.

export type PromptRowLike = Record<string, any>;
export type CampaignRowLike = Record<string, any>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

export const promptIdOf = (p: PromptRowLike): number => num(p.id ?? p.Id);
export const promptCampaignOf = (p: PromptRowLike): number => num(p.campaignsId ?? p.Campaigns_id ?? p.campaigns_id);
export const isActivePrompt = (p: PromptRowLike): boolean => String(p.status ?? "").toLowerCase().trim() === "active";
export const isConversationPrompt = (p: PromptRowLike): boolean =>
  String(p.useCase ?? p.use_case ?? "").toLowerCase().trim() === "conversation";

/** The prompt a campaign picked, or 0. */
export const pickedPromptOf = (c: CampaignRowLike): number => num(c.prompt_id ?? c.promptId);
const borrowsFrom = (c: CampaignRowLike): number => num(c.prompt_campaign_id ?? c.promptCampaignId);
const createdAt = (p: PromptRowLike): number => new Date(p.createdAt ?? p.created_at ?? 0).getTime() || 0;

/** Returns campaign id -> the prompt row it runs (null: the account's or the built-in default). */
export function campaignPromptResolver(prompts: PromptRowLike[], campaigns: CampaignRowLike[]) {
  const byId = new Map(prompts.map((p) => [promptIdOf(p), p]));
  const campaignById = new Map(campaigns.map((c) => [num(c.id ?? c.Id), c]));
  const own = new Map<number, PromptRowLike>();
  for (const p of prompts) {
    const cid = promptCampaignOf(p);
    const variant = String(p.abVariant ?? p.ab_variant ?? "");
    if (!cid || !isActivePrompt(p) || !isConversationPrompt(p) || (variant && variant !== "A")) continue;
    const cur = own.get(cid);
    if (!cur || createdAt(p) > createdAt(cur)) own.set(cid, p);
  }
  const resolveOne = (campaignId: number): PromptRowLike | null => {
    const picked = byId.get(pickedPromptOf(campaignById.get(campaignId) ?? {}));
    if (picked && isActivePrompt(picked)) return picked;
    return own.get(campaignId) ?? null;
  };
  return (campaignId: number): PromptRowLike | null => {
    const row = resolveOne(campaignId);
    if (row) return row;
    const alias = borrowsFrom(campaignById.get(campaignId) ?? {});
    return alias && alias !== campaignId ? resolveOne(alias) : null;
  };
}

/** Prompt id -> the campaigns that run it. */
export function campaignsByPrompt(prompts: PromptRowLike[], campaigns: CampaignRowLike[]): Map<number, CampaignRowLike[]> {
  const resolve = campaignPromptResolver(prompts, campaigns);
  const out = new Map<number, CampaignRowLike[]>();
  for (const c of campaigns) {
    const row = resolve(num(c.id ?? c.Id));
    if (!row) continue;
    const list = out.get(promptIdOf(row)) ?? [];
    list.push(c);
    out.set(promptIdOf(row), list);
  }
  return out;
}
