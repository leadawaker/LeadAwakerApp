import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchLeads,
  fetchInteractions,
  sendMessage,
  updateLeadTakeover,
} from "../api/conversationsApi";

export interface Lead {
  id: number;
  account_id: number;
  accounts_id: number;
  campaign_id: number;
  campaigns_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email: string;
  conversion_status: string;
  source: string;
  priority: string;
  message_count_received: number;
  tags: string[];
  [key: string]: any;
}

export interface Interaction {
  id: number;
  lead_id: number;
  leads_id: number;
  account_id: number;
  accounts_id: number;
  campaign_id: number;
  campaigns_id: number;
  created_at: string;
  createdAt: string;
  type: string;
  direction: "Inbound" | "Outbound";
  content: string;
  status: string;
  who: string;
  Who?: string;
  ai_generated?: boolean;
  is_manual_follow_up?: boolean;
  isManualFollowUp?: boolean;
  is_bump?: boolean;
  bump_number?: number | null;
  triggered_by?: string | null;
  ai_model?: string | null;
  [key: string]: any;
}

export interface Thread {
  lead: Lead;
  msgs: Interaction[];
  last: Interaction | undefined;
  unread: boolean;
}

const POLL_INTERVAL = 15_000; // 15 seconds

export type AiStateFilter = "all" | "ai" | "human";

export function useConversationsData(
  currentAccountId?: number,
  campaignId: number | "all" = "all",
  tab: "all" | "unread" = "all",
  searchQuery = "",
  aiStateFilter: AiStateFilter = "all",
) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [leadsData, interactionsData] = await Promise.all([
        fetchLeads(currentAccountId),
        fetchInteractions(currentAccountId),
      ]);
      setLeads(leadsData);
      setInteractions(interactionsData);
    } catch (err) {
      console.error("Failed to load conversations data", err);
      if (!silent) {
        setError(err instanceof Error ? err : new Error(String(err)));
        toast({ variant: "destructive", title: "Failed to load conversations" });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentAccountId, toast]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for new messages
  useEffect(() => {
    pollRef.current = setInterval(() => loadData(true), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  // Build threads
  const threads = useMemo<Thread[]>(() => {
    const scoped = leads
      .filter((l) => {
        const aid = l.account_id ?? l.accounts_id;
        return !currentAccountId || aid === currentAccountId;
      })
      .filter((l) => {
        const cid = l.campaign_id ?? l.campaigns_id;
        return campaignId === "all" || cid === campaignId;
      });

    const query = searchQuery.toLowerCase().trim();

    const all = scoped
      .map((lead) => {
        const leadId = lead.id;
        const msgs = interactions
          .filter((i) => (i.lead_id ?? i.leads_id ?? i.Leads_id) === leadId)
          .sort((a, b) =>
            (a.created_at ?? a.createdAt ?? "").localeCompare(
              b.created_at ?? b.createdAt ?? "",
            ),
          );
        const last = msgs[msgs.length - 1];
        const unread =
          msgs.filter((m) => m.direction === "Inbound").length > 0 &&
          (lead.message_count_received ?? 0) > 0;
        return { lead, msgs, last, unread };
      })
      .filter((t) => {
        if (!query) return true;
        const name =
          (t.lead.full_name ?? `${t.lead.first_name ?? ""} ${t.lead.last_name ?? ""}`).toLowerCase();
        const phone = (t.lead.phone ?? "").toLowerCase();
        const email = (t.lead.email ?? "").toLowerCase();
        const lastMsg = (t.last?.content ?? t.last?.Content ?? "").toLowerCase();
        return (
          name.includes(query) ||
          phone.includes(query) ||
          email.includes(query) ||
          lastMsg.includes(query)
        );
      })
      .sort((a, b) =>
        (b.last?.created_at ?? b.last?.createdAt ?? "").localeCompare(
          a.last?.created_at ?? a.last?.createdAt ?? "",
        ),
      );

    // Filter by AI/human state
    const stateFiltered =
      aiStateFilter === "all"
        ? all
        : aiStateFilter === "human"
        ? all.filter((t) => t.lead.manual_takeover === true)
        : all.filter((t) => !t.lead.manual_takeover);

    if (tab === "unread") return stateFiltered.filter((t) => t.unread);
    return stateFiltered;
  }, [leads, interactions, currentAccountId, campaignId, tab, searchQuery, aiStateFilter]);

  // Send message
  const handleSend = useCallback(
    async (
      leadId: number,
      content: string,
      type = "SMS",
    ) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead || !content.trim()) return;

      const accountId = lead.accounts_id ?? lead.account_id;
      const campaignIdVal = lead.campaigns_id ?? lead.campaign_id;

      // Optimistic update
      const tempId = Date.now();
      const optimistic: Interaction = {
        id: tempId,
        lead_id: leadId,
        leads_id: leadId,
        account_id: accountId,
        accounts_id: accountId,
        campaign_id: campaignIdVal,
        campaigns_id: campaignIdVal,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        type,
        direction: "Outbound",
        content: content.trim(),
        status: "sending",
        who: "Agent",
      };

      setInteractions((prev) => [...prev, optimistic]);
      setSending(true);

      try {
        const saved = await sendMessage({
          leadsId: leadId,
          accountsId: accountId,
          campaignsId: campaignIdVal,
          content: content.trim(),
          type,
          direction: "Outbound",
          status: "sent",
          who: "Agent",
        });

        // Replace optimistic with real
        setInteractions((prev) =>
          prev.map((i) => (i.id === tempId ? saved : i)),
        );
        toast({ title: "Message sent" });
      } catch (err) {
        // Mark as failed
        setInteractions((prev) =>
          prev.map((i) =>
            i.id === tempId ? { ...i, status: "failed" } : i,
          ),
        );
        toast({ variant: "destructive", title: "Failed to send message" });
      } finally {
        setSending(false);
      }
    },
    [leads, toast],
  );

  // Toggle AI / Human takeover for a lead
  const handleToggleTakeover = useCallback(
    async (leadId: number, manualTakeover: boolean) => {
      // Optimistic update — flip the lead's manual_takeover in local state immediately
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, manual_takeover: manualTakeover } : l,
        ),
      );
      try {
        await updateLeadTakeover(leadId, manualTakeover);
        toast({
          title: manualTakeover ? "Switched to Human mode" : "Switched to AI mode",
          description: manualTakeover
            ? "AI paused. You are now managing this conversation."
            : "AI is now managing this conversation.",
        });
      } catch (err) {
        // Revert on failure
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, manual_takeover: !manualTakeover } : l,
          ),
        );
        toast({ variant: "destructive", title: "Failed to update takeover state" });
      }
    },
    [toast],
  );

  return {
    leads,
    interactions,
    threads,
    loading,
    error,
    sending,
    handleSend,
    handleToggleTakeover,
    refresh: loadData,
  };
}
