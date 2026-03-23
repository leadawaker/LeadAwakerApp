import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
}

export function useProspectConversations() {
  return useQuery<ProspectThread[]>({
    queryKey: ["/api/prospects/conversations"],
    refetchInterval: 30_000, // refresh every 30s
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
