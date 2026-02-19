import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchLeads,
  fetchInteractions,
  sendMessage,
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
  [key: string]: any;
}

export interface Thread {
  lead: Lead;
  msgs: Interaction[];
  last: Interaction | undefined;
  unread: boolean;
}

const POLL_INTERVAL = 15_000; // 15 seconds

export function useConversationsData(
  currentAccountId?: number,
  campaignId: number | "all" = "all",
  tab: "all" | "unread" = "all",
  searchQuery = "",
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
          .filter((i) => (i.lead_id ?? i.leads_id) === leadId)
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
        const lastMsg = (t.last?.content ?? "").toLowerCase();
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

    if (tab === "unread") return all.filter((t) => t.unread);
    return all;
  }, [leads, interactions, currentAccountId, campaignId, tab, searchQuery]);

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

  return {
    leads,
    interactions,
    threads,
    loading,
    error,
    sending,
    handleSend,
    refresh: loadData,
  };
}
