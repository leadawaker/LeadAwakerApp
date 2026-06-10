import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Task, InsertTask, TaskSubtask, InsertTaskSubtask, TaskCategory, InsertTaskCategory, TaskComment, InsertTaskComment, TaskAttachment, InsertTaskAttachment, TaskActivity } from "@shared/schema";

const TASKS_KEY = ["/api/tasks"];
const CATEGORIES_KEY = ["/api/task-categories"];

export function useAccountUsers() {
  return useQuery<Array<{ id: number; fullName1: string | null; email: string | null; avatarUrl: string | null }>>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiFetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });
}

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
    // Mark stale but don't trigger an immediate refetch — the optimistic update
    // already reflects the change. A full refetch happens on next focus/remount.
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY, refetchType: "none" }),
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
    onSuccess: (_res, { taskId }) => {
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) });
      qc.invalidateQueries({ queryKey: ["/api/subtask-counts"] });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId, data }: { id: number; taskId: number; data: Partial<InsertTaskSubtask> }) =>
      apiRequest("PATCH", `/api/subtasks/${id}`, data),
    onSuccess: (_res, { taskId }) => {
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) });
      qc.invalidateQueries({ queryKey: ["/api/subtask-counts"] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) =>
      apiRequest("DELETE", `/api/subtasks/${id}`),
    onSuccess: (_res, { taskId }) => {
      qc.invalidateQueries({ queryKey: subtasksKey(taskId) });
      qc.invalidateQueries({ queryKey: ["/api/subtask-counts"] });
    },
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

// ─── Subtask Counts (for progress indicators on task cards) ──────────────

export interface SubtaskCount {
  taskId: number;
  total: number;
  completed: number;
}

const SUBTASK_COUNTS_KEY = ["/api/subtask-counts"];

export function useSubtaskCounts() {
  return useQuery<SubtaskCount[]>({
    queryKey: SUBTASK_COUNTS_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/subtask-counts");
      if (!res.ok) throw new Error("Failed to fetch subtask counts");
      return res.json();
    },
  });
}

export interface CommentCount { taskId: number; count: number; }
const COMMENT_COUNTS_KEY = ["/api/comment-counts"];

export function useCommentCounts() {
  return useQuery<CommentCount[]>({
    queryKey: COMMENT_COUNTS_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/comment-counts");
      if (!res.ok) throw new Error("Failed to fetch comment counts");
      return res.json();
    },
    staleTime: 30 * 1000,
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

// ─── Task Categories ──────────────────────────────────────────────────────────

export function useTaskCategories() {
  return useQuery<TaskCategory[]>({
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/task-categories");
      if (!res.ok) throw new Error("Failed to fetch task categories");
      return res.json();
    },
  });
}

export function useCreateTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InsertTaskCategory>) =>
      apiRequest("POST", "/api/task-categories", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useUpdateTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertTaskCategory> }) =>
      apiRequest("PATCH", `/api/task-categories/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useDeleteTaskCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/task-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

// ─── Task Comments ────────────────────────────────────────────────────────────

function commentsKey(taskId: number) {
  return ["/api/tasks", taskId, "comments"] as const;
}

export function useTaskComments(taskId: number) {
  return useQuery<TaskComment[]>({
    queryKey: commentsKey(taskId),
    queryFn: async () => {
      const res = await apiFetch(`/api/tasks/${taskId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!taskId,
    refetchInterval: 15 * 1000,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: { body: string; authorName: string } }) =>
      apiRequest("POST", `/api/tasks/${taskId}/comments`, data),
    onSuccess: (_res, { taskId }) => {
      qc.invalidateQueries({ queryKey: commentsKey(taskId) });
      qc.invalidateQueries({ queryKey: COMMENT_COUNTS_KEY });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; taskId: number; body: string }) =>
      apiRequest("PATCH", `/api/task-comments/${id}`, { body }),
    onSuccess: (_res, { taskId }) => qc.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) =>
      apiRequest("DELETE", `/api/task-comments/${id}`),
    onSuccess: (_res, { taskId }) => qc.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}

// ─── Task Activity ──────────────────────────────────────────────────────────────

function activityKey(taskId: number) {
  return ["/api/tasks", taskId, "activity"] as const;
}

export function useTaskActivity(taskId: number) {
  return useQuery<TaskActivity[]>({
    queryKey: activityKey(taskId),
    queryFn: async () => {
      const res = await apiFetch(`/api/tasks/${taskId}/activity`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    enabled: !!taskId,
    staleTime: 10 * 1000,
  });
}

// ─── Task Attachments ─────────────────────────────────────────────────────────

function attachmentsKey(taskId: number) {
  return ["/api/tasks", taskId, "attachments"] as const;
}

export function useTaskAttachments(taskId: number) {
  return useQuery<TaskAttachment[]>({
    queryKey: attachmentsKey(taskId),
    queryFn: async () => {
      const res = await apiFetch(`/api/tasks/${taskId}/attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!taskId,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: { fileName: string; fileData: string; mimeType?: string; uploadedBy?: string } }) =>
      apiRequest("POST", `/api/tasks/${taskId}/attachments`, data),
    onSuccess: (_res, { taskId }) => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number }) =>
      apiRequest("DELETE", `/api/task-attachments/${id}`),
    onSuccess: (_res, { taskId }) => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
  });
}
