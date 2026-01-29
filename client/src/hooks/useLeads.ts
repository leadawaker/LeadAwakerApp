import useSWR from "swr";
import { leads as mockLeads, type Lead } from "@/data/mocks";

const isMock = true;

// REAL: useSWR('/api/v1/db/data/nocodb/Leads')
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      // REAL: Authorization: `Bearer ${import.meta.env.VITE_NOCODB_TOKEN}`
    },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export function useLeads() {
  if (isMock) {
    return {
      leads: mockLeads,
      isLoading: false,
      error: null as unknown,
    };
  }

  // REAL: const { data, error, isLoading } = useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/Leads`, fetcher)
  const { data, error, isLoading } = useSWR("/api/v1/db/data/nocodb/Leads", fetcher);

  return {
    leads: (data?.list ?? []) as Lead[],
    isLoading,
    error,
  };
}
