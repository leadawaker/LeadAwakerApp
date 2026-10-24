// Side writes that go with saving or creating a campaign, shared by every place
// that hosts the campaign settings (the Campaigns page, Accounts > Reactivation, Demos).
import { apiFetch } from "@/lib/apiUtils";

/**
 * When business profile fields are saved, write them back to the niche
 * template so future campaigns pre-fill with the latest values. Best-effort:
 * a failure never blocks the save. Agency callers only.
 */
export async function syncNicheTemplate(niche: string, patch: Record<string, unknown>): Promise<void> {
  const n = niche.trim();
  const hasBusinessFields = "company_name" in patch || "description" in patch || "kb" in patch;
  if (!n || !hasBusinessFields) return;
  try {
    const toTemplate = (raw: unknown): { nl: string; en: string } | undefined => {
      if (!raw) return undefined;
      const s = String(raw).trim();
      if (s.startsWith("{")) {
        try { return JSON.parse(s); } catch { /* ok */ }
      }
      return s ? { nl: s, en: s } : undefined;
    };
    const body: Record<string, unknown> = {};
    if ("company_name" in patch) {
      const v = String(patch.company_name ?? "").trim();
      if (v) body.companyNameTemplate = { nl: v, en: v };
    }
    if ("description" in patch) body.descriptionTemplate = toTemplate(patch.description);
    if ("kb" in patch) body.kbTemplate = toTemplate(patch.kb);
    if (Object.keys(body).length) {
      await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(n)}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  } catch {
    // Non-critical: best-effort template sync.
  }
}

/**
 * Give a new campaign the default tags: a copy of the tag set of the campaign
 * that has the most tags. Best-effort, like the template sync above.
 */
export async function cloneDefaultTags(campaignId: number, campaignName: string): Promise<void> {
  try {
    const tagsRes = await apiFetch("/api/tags");
    if (!tagsRes.ok) return;
    const allTags: any[] = await tagsRes.json();
    if (!Array.isArray(allTags) || allTags.length === 0) return;
    const byCampaign = new Map<number, any[]>();
    allTags.forEach((tag) => {
      if (tag.campaign_id && tag.campaign_id !== campaignId) {
        if (!byCampaign.has(tag.campaign_id)) byCampaign.set(tag.campaign_id, []);
        byCampaign.get(tag.campaign_id)!.push(tag);
      }
    });
    let templateTags: any[] = [];
    byCampaign.forEach((tags) => {
      if (tags.length > templateTags.length) templateTags = tags;
    });
    if (templateTags.length === 0) return;
    await Promise.allSettled(
      templateTags.map((tag) =>
        apiFetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tag.name,
            color: tag.color,
            category: tag.category,
            description: tag.description,
            campaign_id: campaignId,
            campaign_name: campaignName,
          }),
        }),
      ),
    );
  } catch (tagErr) {
    console.error("Failed to auto-create default tags:", tagErr);
  }
}
