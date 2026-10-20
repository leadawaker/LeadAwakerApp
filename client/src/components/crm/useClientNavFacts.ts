import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";
import { useHomeServices } from "@/features/home/api/homeApi";
import { fetchInvoices } from "@/features/billing/api/invoicesApi";
import type { ClientNavFacts } from "./navGates";

/** The facts that gate the client nav. Invoices are only fetched for client users. */
export function useClientNavFacts(): ClientNavFacts {
  const { isAgencyUser, currentAccountId } = useWorkspace();
  const { data: caps } = useVoiceCapabilities();
  const { data: services } = useHomeServices(currentAccountId);
  const { data: invoices } = useQuery({
    queryKey: ["/api/invoices", "nav-has-any", currentAccountId],
    queryFn: () => fetchInvoices(currentAccountId),
    enabled: !isAgencyUser && currentAccountId > 0,
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => ({
    voiceLive: !!caps?.live,
    hasInvoices: Array.isArray(invoices) && invoices.length > 0,
    hasReactivation: !!services?.reactivation,
    // Until services load, assume a receptionist so the label does not flicker to "My account".
    hasReceptionist: services ? !!(services.phone || services.website) : true,
    hasChats: !!(services?.website || services?.whatsapp),
  }), [caps?.live, invoices, services]);
}
