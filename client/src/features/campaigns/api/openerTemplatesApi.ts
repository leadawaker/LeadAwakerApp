import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";

/** Which conversation type an archetype is written for. Same tokens the engine
 *  branches on (derive_conversation_mode); "both" commits to neither. */
export const OPENER_TEMPLATE_TYPES = ["scoping", "decision", "both"] as const;
export type OpenerTemplateType = (typeof OPENER_TEMPLATE_TYPES)[number];

export interface OpenerTemplateRow {
  id: string;
  sort_order: number;
  type: OpenerTemplateType;
  title_en: string;
  title_nl: string;
  body_en: string;
  body_nl: string;
  updated_at?: string | null;
}

export interface OpenerTemplateEdit {
  title_en?: string;
  title_nl?: string;
  body_en?: string;
  body_nl?: string;
  type?: OpenerTemplateType;
}

const OPENER_TEMPLATES_KEY = ["/api/opener-templates"];

export function useOpenerTemplates() {
  return useQuery<OpenerTemplateRow[]>({
    queryKey: OPENER_TEMPLATES_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/opener-templates");
      if (!res.ok) throw new Error("Failed to fetch opener templates");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateOpenerTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OpenerTemplateEdit }) =>
      apiRequest("PATCH", `/api/opener-templates/${id}`, data).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: OPENER_TEMPLATES_KEY }),
  });
}
