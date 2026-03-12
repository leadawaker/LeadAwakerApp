import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Task, InsertTask, TaskSubtask, InsertTaskSubtask } from "@shared/schema";

const TASKS_KEY = ["/api/tasks"];

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertTask) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertTask> }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previous = qc.getQueryData<Task[]>(TASKS_KEY);
      qc.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...data } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(TASKS_KEY, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

// ─── Subtask hooks ────────────────────────────────────────────────────────

function subtasksKey(taskId: number) {
  return ["/api/tasks", taskId, "subtasks"] as const;
}

export function useSubtasks(taskId: number) {
  return useQuery<TaskSubtask[]>({
    queryKey: subtasksKey(taskId),
    queryFn: async () => {
      const res = await apiFetch(`/api/tasks/${taskId}/subtasks`);
      if (!res.ok) throw new Error("Failed to fetch subtasks");
      return res.json();
    },
    enabled: !!taskId,
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Partial<InsertTaskSubtask> }) =>
      apiRequest("POST", `/api/tasks/${taskId}/subtasks`, data),
    onSuccess: (_res, { taskId }) =>
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) }),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId, data }: { id: number; taskId: number; data: Partial<InsertTaskSubtask> }) =>
      apiRequest("PATCH", `/api/subtasks/${id}`, data),
    onSuccess: (_res, { taskId }) =>
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) }),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) =>
      apiRequest("DELETE", `/api/subtasks/${id}`),
    onSuccess: (_res, { taskId }) =>
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) }),
  });
}

export function useReorderSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskIds }: { taskId: number; subtaskIds: number[] }) =>
      apiRequest("PATCH", `/api/tasks/${taskId}/subtasks/reorder`, { subtaskIds }),
    onSuccess: (_res, { taskId }) =>
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) }),
  });
}

// ─── Task Stats (progress chart) ──────────────────────────────────────────

export interface TaskStatPoint {
  date: string;
  completedCount: number;
}

const STATS_KEY = ["/api/tasks/stats"];

export function useTaskStats(params?: { categoryId?: number; startDate?: string; endDate?: string }) {
  const qs = new URLSearchParams();
  if (params?.categoryId !== undefined) qs.set("categoryId", String(params.categoryId));
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.endDate) qs.set("endDate", params.endDate);
  const suffix = qs.toString() ? `?${qs}` : "";

  return useQuery<TaskStatPoint[]>({
    queryKey: [...STATS_KEY, params],
    queryFn: async () => {
      const res = await apiFetch(`/api/tasks/stats${suffix}`);
      if (!res.ok) throw new Error("Failed to fetch task stats");
      const rows = await res.json();
      return rows.map((r: { date: string; completedCount: string | number }) => ({
        date: r.date,
        completedCount: Number(r.completedCount),
      }));
    },
  });
}
