import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCadenceQueue,
  enterCadence as enterCadenceApi,
  logContact as logContactApi,
  skipCadence as skipCadenceApi,
} from "../api/cadenceApi";

const QUERY_KEY = ["cadenceQueue"] as const;

export function useCadenceQueue() {
  const qc = useQueryClient();

  const { data: queue = [], isLoading } = useQuery<any[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchCadenceQueue,
  });

  // Invalidate when the AI bot or external process mutates CRM data
  useEffect(() => {
    const handler = () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); };
    window.addEventListener("crm-data-changed", handler);
    return () => window.removeEventListener("crm-data-changed", handler);
  }, [qc]);

  const logContactMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { channel: string; notes?: string } }) =>
      logContactApi(id, payload),
    onSettled: () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });

  const enterCadenceMutation = useMutation({
    mutationFn: (id: number) => enterCadenceApi(id),
    onSettled: () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });

  const skipCadenceMutation = useMutation({
    mutationFn: (id: number) => skipCadenceApi(id),
    onSettled: () => { qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });

  return {
    queue,
    isLoading,
    logContact: logContactMutation.mutate,
    enterCadence: enterCadenceMutation.mutate,
    skipCadence: skipCadenceMutation.mutate,
  };
}
