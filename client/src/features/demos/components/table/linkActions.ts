// Shared by the link cells: copying, and minting a service link for a prospect row. No JSX.
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { useCreateDemoLink } from "../../api/demoSessionsApi";
import type { ProspectRow } from "../../prospectRows";
import type { ServiceDef } from "../../services";
import { mintInputForRow } from "../../tableColumns";

/** False when the browser refuses (no clipboard permission, insecure origin). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Mints this service's link on the prospect's row. Resolves true once the link exists. */
export function useMintLink(row: ProspectRow, svc: ServiceDef) {
  const { t } = useTranslation("demos");
  const create = useCreateDemoLink();

  const mint = async (): Promise<boolean> => {
    // mintInputForRow throws for a service with no campaign; the cell shows "-" for those, this keeps it so.
    if (svc.campaignId == null) return false;
    try {
      await create.mutateAsync(mintInputForRow(row, svc));
      return true;
    } catch (e) {
      toast({ variant: "destructive", title: t("new.failed"), description: e instanceof Error ? e.message : undefined });
      return false;
    }
  };

  return { mint, pending: create.isPending };
}
