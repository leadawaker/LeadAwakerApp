// Loads everything the preview and the Variables panel resolve from for the
// "Preview as" pick: the campaign row, its account, a sample lead, the niche
// words, and for a demo Client its persona. Also applies a saved write back
// into that state, so the preview updates without a refetch.
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { toCampaignForPreview, type AccountForPreview, type CampaignForPreview, type LeadForPreview } from "../../utils/resolveVariables";
import { demoBaseCampaign, nicheTermValues, clientValues, parseContextKey, writableVocab, type PreviewContextKey, type VocabListRow } from "../../utils/previewContext";
import type { DemoClientEditable, WriteResult, WriteTarget } from "../../utils/variableWrites";

export interface DemoClientOption { niche: string; label: string; isLive: boolean }

const asJson = async (url: string) => {
  const r = await apiFetch(url);
  return r.ok ? r.json() : null;
};

function toAccount(a: any): AccountForPreview | null {
  if (!a) return null;
  return {
    name: a.name ?? null,
    defaultAiName: a.default_ai_name ?? a.defaultAiName ?? null,
    defaultAiRole: a.default_ai_role ?? a.defaultAiRole ?? null,
    defaultAiStyle: a.default_ai_style ?? a.defaultAiStyle ?? null,
    defaultTypoFrequency: a.default_typo_frequency ?? a.defaultTypoFrequency ?? null,
    businessDescription: a.business_description ?? a.businessDescription ?? null,
    businessNiche: a.business_niche ?? a.businessNiche ?? null,
    language: a.language ?? null,
    callingNumber: a.calling_number ?? a.callingNumber ?? null,
    phone: a.phone ?? null,
    meetingType: a.meeting_type ?? a.meetingType ?? null,
  };
}

function toLead(l: any): LeadForPreview | null {
  if (!l) return null;
  return {
    firstName: l.first_name ?? l.firstName ?? null,
    lastName: l.last_name ?? l.lastName ?? null,
    phone: l.phone ?? null,
    email: l.email ?? null,
    whatHasTheLeadDone: l.what_has_the_lead_done ?? l.whatHasTheLeadDone ?? null,
    language: l.language ?? null,
    leadContext: l.lead_context ?? l.leadContext ?? null,
    when: l.when ?? null,
  };
}

export function usePreviewContext({ enabled, contextKey, campaigns, servingIds, nicheOverride, uiLang }: {
  enabled: boolean;
  contextKey: PreviewContextKey;
  campaigns: CampaignForPreview[];
  /** Campaigns that run this prompt. */
  servingIds: number[];
  /** A niche picked in Preview conditions, instead of the campaign's own. */
  nicheOverride: string;
  uiLang: string;
}) {
  const parsed = parseContextKey(contextKey);
  const clientNiche = parsed?.kind === "client" ? parsed.niche : null;
  const baseCampaignId = parsed?.kind === "campaign" ? parsed.id
    : parsed?.kind === "client" ? demoBaseCampaign(campaigns, servingIds)?.id ?? 0 : 0;

  const [vocabRows, setVocabRows] = useState<VocabListRow[]>([]);
  const [demoClients, setDemoClients] = useState<DemoClientOption[]>([]);
  const [campaignRaw, setCampaignRaw] = useState<any | null>(null);
  const [accountRaw, setAccountRaw] = useState<any | null>(null);
  const [lead, setLead] = useState<LeadForPreview | null>(null);
  const [client, setClient] = useState<DemoClientEditable | null>(null);

  // Shared lists, once per open preview.
  useEffect(() => {
    if (!enabled) return;
    asJson("/api/niche-vocabulary").then((rows) => setVocabRows(Array.isArray(rows) ? rows : [])).catch(() => setVocabRows([]));
    asJson("/api/demo/clients")
      .then((d) => setDemoClients(((d?.clients ?? []) as any[])
        .filter((c) => c.isDemoClient || c.isLive)
        .map((c) => ({ niche: c.niche, label: c.label || c.niche, isLive: !!c.isLive }))))
      .catch(() => setDemoClients([]));
  }, [enabled]);

  // The picked campaign (or the demo campaign a Client runs on), its account and a sample lead.
  useEffect(() => {
    if (!enabled || !baseCampaignId) { setCampaignRaw(null); setAccountRaw(null); setLead(null); return; }
    let cancelled = false;
    (async () => {
      const row = await asJson(`/api/campaigns/${baseCampaignId}`).catch(() => null);
      if (cancelled) return;
      setCampaignRaw(row);
      const accountId = row?.Accounts_id ?? row?.accountsId;
      const [acct, leads] = await Promise.all([
        accountId ? asJson(`/api/accounts/${accountId}`).catch(() => null) : Promise.resolve(null),
        // A demo Client has no real lead; a campaign shows its first one.
        clientNiche ? Promise.resolve(null) : asJson(`/api/leads?campaignId=${baseCampaignId}&page=1&limit=1`).catch(() => null),
      ]);
      if (cancelled) return;
      setAccountRaw(acct);
      const first = Array.isArray(leads) ? leads[0] : Array.isArray(leads?.data) ? leads.data[0] : null;
      setLead(toLead(first));
    })();
    return () => { cancelled = true; };
  }, [enabled, baseCampaignId, clientNiche]);

  useEffect(() => {
    if (!enabled || !clientNiche) { setClient(null); return; }
    let cancelled = false;
    asJson(`/api/demo/clients/${encodeURIComponent(clientNiche)}`)
      .then((d) => { if (!cancelled) setClient(d?.client ?? null); })
      .catch(() => { if (!cancelled) setClient(null); });
    return () => { cancelled = true; };
  }, [enabled, clientNiche]);

  const campaign = useMemo<CampaignForPreview | null>(
    () => (campaignRaw ? toCampaignForPreview(campaignRaw) : campaigns.find((c) => c.id === baseCampaignId) ?? null),
    [campaignRaw, campaigns, baseCampaignId],
  );
  const account = useMemo(() => toAccount(accountRaw), [accountRaw]);
  const ui = (uiLang || "en").toLowerCase();
  const clientLang: "en" | "nl" | "pt" = ui.startsWith("nl") ? "nl" : ui.startsWith("pt") ? "pt" : "en";
  // The engine's _norm_lang: {en,nl} fields and niche words have no pt slot.
  const fieldLang: "en" | "nl" = clientNiche
    ? (clientLang === "nl" ? "nl" : "en")
    : (campaign?.language || "en").toLowerCase().startsWith("nl") ? "nl" : "en";
  const vocabNiche = nicheOverride || (campaign?.niche || "").trim() || "__default__";

  const nicheTerms = useMemo(() => nicheTermValues(vocabRows, vocabNiche, fieldLang), [vocabRows, vocabNiche, fieldLang]);
  const extra = useMemo(() => (client ? clientValues(client, clientLang, nicheTerms) : undefined), [client, clientLang, nicheTerms]);

  const target = useMemo<WriteTarget>(() => {
    const w = writableVocab(vocabRows, vocabNiche);
    return { campaignRaw, accountRaw, vocabNiche, vocabRow: w.row, packs: w.packs, client, fieldLang, clientLang };
  }, [campaignRaw, accountRaw, vocabRows, vocabNiche, client, fieldLang, clientLang]);

  /** Folds a saved write into the loaded state. */
  const applyWrite = useCallback((r: WriteResult) => {
    if (!r.ok) return;
    if (r.campaignRow) setCampaignRaw(r.campaignRow);
    if (r.accountRow) setAccountRaw(r.accountRow);
    if (r.client) setClient(r.client);
    if (r.vocabRow || r.packs) {
      setVocabRows((rows) => {
        const niche = r.vocabRow?.niche ?? vocabNiche;
        const existing = rows.find((x) => x.niche === niche);
        const merged = { ...(existing ?? { niche, nl: r.vocabRow!.nl, en: r.vocabRow!.en }), ...(r.vocabRow ?? {}), ...(r.packs ?? {}) } as VocabListRow;
        return existing ? rows.map((x) => (x.niche === niche ? merged : x)) : [...rows, merged];
      });
    }
  }, [vocabNiche]);

  return {
    kind: clientNiche ? ("client" as const) : ("campaign" as const),
    campaign,
    account,
    accountName: (accountRaw?.name as string | undefined) ?? null,
    lead,
    demoClients,
    availableNiches: vocabRows.map((r) => r.niche).filter((n) => n && n !== "__default__"),
    nicheTerms,
    extra,
    fieldLang,
    target,
    applyWrite,
  };
}

export type PreviewContextState = ReturnType<typeof usePreviewContext>;
