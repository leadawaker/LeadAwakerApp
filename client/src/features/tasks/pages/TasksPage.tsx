import { useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CrmShell } from "@/components/crm/CrmShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTasks, useTaskCategories, useAccountUsers } from "../api/tasksApi";
import { TagVisibilityContext } from "../context/TagVisibilityContext";
import { getTodayISO } from "../lib/taskViewUtils";
import type { Task } from "../types";
import DesktopTasksView from "../components/DesktopTasksView";
import MobileTasksView from "../components/MobileTasksView";

export default function TasksPage() {
  const { data: rawTasks, isLoading: tasksLoading } = useTasks();
  const tasks = (rawTasks ?? []) as Task[];
  const { data: categories = [] } = useTaskCategories();
  const { data: users = [] } = useAccountUsers();
  const isMobile = useIsMobile(768);
  const queryClient = useQueryClient();

  const todayISO = useMemo(() => getTodayISO(), []);
  const currentUserName = useMemo(() => {
    try { return localStorage.getItem("leadawaker_user_name") || ""; } catch { return ""; }
  }, []);

  // Live-refresh on task changes pushed by the automation/SSE stream.
  useEffect(() => {
    const es = new EventSource("/api/interactions/stream");
    es.addEventListener("tasks_changed", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    });
    return () => { es.close(); };
  }, [queryClient]);

  return (
    <TagVisibilityContext.Provider value={true}>
      <CrmShell>
        {isMobile ? (
          <MobileTasksView tasks={tasks} categories={categories} users={users} todayISO={todayISO} />
        ) : (
          <DesktopTasksView tasks={tasks} categories={categories} users={users} todayISO={todayISO} currentUserName={currentUserName} loading={tasksLoading} />
        )}
      </CrmShell>
    </TagVisibilityContext.Provider>
  );
}
