import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export interface ProspectThread {
  prospect_id: number;
  name: string;
  company: string;
  contact_name: string;
  contact_email: string;
  niche: string;
  outreach_status: string;
  priority: string;
  unread_count: number;
  total_messages: number;
  last_message_at: string;
  last_message: string;
  last_message_direction: string;
  last_message_type: string;
  contact_phone: string | null;
  phone: string | null;
}

export function useProspectConversations() {
  const qc = useQueryClient();

  // Wire into the shared SSE stream for real-time updates instead of relying solely on polling
  useEffect(() => {
    const es = new EventSource("/api/interactions/stream", { withCredentials: true });

    es.addEventListener("new_interaction", (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        const prospectId = raw.prospect_id ?? raw.prospectId;
        if (!prospectId) return; // lead message, not a prospect
        qc.invalidateQueries({ queryKey: ["/api/prospects/conversations"] });
        qc.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("interaction_updated", (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data);
        const prospectId = raw.prospect_id ?? raw.prospectId;
        if (!prospectId) return;
        qc.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
      } catch {
        // ignore parse errors
      }
    });

    return () => es.close();
  }, [qc]);

  return useQuery<ProspectThread[]>({
    queryKey: ["/api/prospects/conversations"],
    refetchInterval: 60_000, // slow fallback in case SSE misses an event
  });
}

export function useProspectMessages(prospectId: number | null) {
  return useQuery({
    queryKey: ["/api/prospects", prospectId, "messages"],
    queryFn: async () => {
      if (!prospectId) return [];
      const res = await fetch(`/api/prospects/${prospectId}/messages?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch prospect messages");
      return res.json();
    },
    enabled: !!prospectId,
  });
}

export function useMarkProspectRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospectId: number) => {
      const res = await fetch("/api/interactions/mark-read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/prospects/conversations"] });
    },
  });
}
